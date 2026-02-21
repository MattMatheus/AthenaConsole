import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { compileContext, truncateOversizedToolResults, type ContextMessage } from "../context/index.js";
import { loadConfig, type AthenaConfig } from "../shared/config.js";
import type { ContextCompactionMetadata, ContextRecoveryStep, ContextStrategy, RunRequest, RunResult } from "../shared/contracts.js";
import { createDefaultProviderRegistry, type ProviderRegistry } from "../providers/index.js";
import { acquireSessionLock } from "./session-lock.js";
import { assertValidSessionId, SessionStore } from "./session-store.js";
import { asAthenaError, AthenaError } from "./errors.js";
import { sanitizeTranscriptHistory } from "./history.js";
import { buildMemoryInjectionSection, createMemoryManager } from "../memory/index.js";
import { RuntimeCancellationStore } from "./cancellation.js";

export interface Runtime {
  run(request: RunRequest, options?: RuntimeRunOptions): Promise<RunResult>;
  attachEvidence(label: string, content: string | unknown | ArrayBuffer | Uint8Array, type: RuntimeEvidenceType): void;
}

export interface RuntimeOptions {
  config?: AthenaConfig;
  providers?: ProviderRegistry;
  maxAttempts?: number;
}

export type RuntimeEvidenceType = "text" | "json" | "binary";

export interface RuntimeEvidenceAttachment {
  sessionId: string;
  runId: string;
  traceId: string;
  metadata: Record<string, string>;
  label: string;
  type: RuntimeEvidenceType;
  content: string | unknown;
}

export interface RuntimeRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onAttachEvidence?: (attachment: RuntimeEvidenceAttachment) => Promise<void>;
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const config = options.config ?? loadConfig();
  const providers = options.providers ?? createDefaultProviderRegistry(config);
  const maxAttempts = options.maxAttempts ?? 2;
  const sessionStore = new SessionStore(config);
  const memoryManager = createMemoryManager(config);
  const cancellationStore = new RuntimeCancellationStore(config);
  const evidenceContext = new AsyncLocalStorage<{
    sessionId: string;
    runId: string;
    traceId: string;
    metadata: Record<string, string>;
    evidenceCount: number;
    onAttachEvidence?: RuntimeRunOptions["onAttachEvidence"];
  }>();

  return {
    async run(request: RunRequest, options: RuntimeRunOptions = {}): Promise<RunResult> {
      if (!request.sessionId.trim()) {
        throw new AthenaError("CONFIG_ERROR", "sessionId is required");
      }
      assertValidSessionId(request.sessionId);
      const rawInput = request.input?.trim();
      if (!rawInput) {
        throw new AthenaError("CONFIG_ERROR", "input is required");
      }

      const providerId = request.provider ?? config.defaultProvider;
      const model = request.model ?? config.defaultModel;
      const providerOrder = resolveProviderOrder(
        providerId,
        request.provider ? [] : config.providerFallbackOrder
      );
      const turnStartedAt = Date.now();
      const runId = randomUUID();
      const runTraceId = randomUUID();

      await sessionStore.ensureStateDirectories();
      try {
        await sessionStore.pruneRunHistoryIfDue();
      } catch {
        // Best-effort retention sweep; never block run execution on sweep failures.
      }
      await cancellationStore.ensureDirectories();
      const lockPath = sessionStore.resolveLockPath(request.sessionId);
      const lock = await acquireSessionLock(lockPath);
      const cancellationController = new AbortController();
      let cancellationWatch: ReturnType<RuntimeCancellationStore["watchForCancellation"]> | undefined;

      try {
        await cancellationStore.markRunActive(request.sessionId, {
          runId,
          traceId: runTraceId
        });
        await cancellationStore.clearCancellationRequest(request.sessionId);
        cancellationWatch = cancellationStore.watchForCancellation(request.sessionId, cancellationController);
        if (options.signal) {
          if (options.signal.aborted) {
            cancellationController.abort();
          } else {
            options.signal.addEventListener("abort", () => cancellationController.abort(), { once: true });
          }
        }

        return evidenceContext.run(
          {
            sessionId: request.sessionId,
            runId,
            traceId: runTraceId,
            metadata: request.metadata ? { ...request.metadata } : {},
            evidenceCount: 0,
            onAttachEvidence: options.onAttachEvidence
          },
          async () => {
            const scope = evidenceContext.getStore();
            if (!scope) {
              throw new AthenaError("SESSION_IO_ERROR", "Runtime evidence context was not initialized.");
            }
            const prepared = await sessionStore.prepareSession(request.sessionId, model, providerId);
            const { entries: sanitizedHistory } = sanitizeTranscriptHistory(prepared.transcript, config);
            const historicalMessages: ContextMessage[] = sanitizedHistory.map((entry) => ({
              role: entry.role,
              content: entry.content,
              ...(entry.kind ? { kind: entry.kind } : {}),
              ...(entry.toolCallId ? { toolCallId: entry.toolCallId } : {}),
              ...(entry.toolName ? { toolName: entry.toolName } : {})
            }));
            const memorySearchOptions: { maxResults?: number } = {};
            if (typeof config.memory?.maxResults === "number") {
              memorySearchOptions.maxResults = config.memory.maxResults;
            }
            const memoryResults = await memoryManager.search(rawInput, memorySearchOptions);
            const memorySection = buildMemoryInjectionSection(memoryResults, config.memory?.maxInjectedChars);
            const contextConfig = resolveContextConfig(config);
            const context = buildContextWithRecovery({
              initialStrategy: contextConfig.strategy,
              messages: [
                ...historicalMessages,
                ...(memorySection
                  ? [
                      {
                        role: "system" as const,
                        content: `Memory recall snippets\n${memorySection}`
                      }
                    ]
                  : []),
                { role: "user", content: rawInput }
              ],
              maxChars: contextConfig.maxChars,
              reserveChars: contextConfig.reserveChars,
              summaryMaxChars: contextConfig.summaryMaxChars,
              maxToolResultChars: contextConfig.maxToolResultChars,
              maxOverflowRetries: contextConfig.maxOverflowRetries
            });

            const runRequest: RunRequest = {
              ...request,
              input: context.content,
              provider: providerId,
              model,
              metadata: {
                ...(request.metadata ?? {}),
                contextStrategy: context.strategy,
                rawInput,
                memoryResults: String(memoryResults.length),
                contextOverflowRecovered: String(context.meta.overflowRecovered),
                contextOverflowAttempts: String(context.meta.overflowAttempts),
                contextCharsBefore: String(context.meta.initialChars),
                contextCharsAfter: String(context.meta.finalChars),
                contextEffectiveMaxChars: String(context.meta.effectiveMaxChars),
                contextRecoverySteps: JSON.stringify(context.meta.steps),
                runId,
                runTraceId
              }
            };

            const runTimeoutMs = options.timeoutMs ?? config.runtimeRunTimeoutMs;
            const watch = cancellationWatch;
            if (!watch) {
              throw new AthenaError("SESSION_IO_ERROR", "Runtime cancellation watch was not initialized.");
            }
            const executionPromise = runWithTimeout(
              (signal) => runWithProviderFallback(providers, providerOrder, runRequest, maxAttempts, signal),
              runTimeoutMs,
              `Run timed out after ${runTimeoutMs}ms`,
              cancellationController.signal
            );
            const cancellationPromise = watch.done.then((reason) => {
              throw new AthenaError("RUN_CANCELLED", reason ? `Run cancelled: ${reason}` : "Run cancelled by API request.");
            });
            const execution = await Promise.race([executionPromise, cancellationPromise]);

            const now = new Date().toISOString();
            const userEntry = sessionStore.createTranscriptEntry("user", rawInput, now);
            const assistantEntry = sessionStore.createTranscriptEntry(
              "assistant",
              execution.result.output,
              now,
              buildContextMetadataMap(context.meta, execution.reliability, runRequest.metadata)
            );
            await sessionStore.appendTranscript(prepared.transcriptPath, [userEntry, assistantEntry]);
            await sessionStore.updateSessionMetadata(request.sessionId, execution.result.model, execution.result.provider);
            const turnLatencyMs = Math.max(0, Date.now() - turnStartedAt);
            const contextCompactions = context.meta.steps.filter((step) => step.applied).length;

            return {
              ...execution.result,
              runId,
              evidenceCount: scope.evidenceCount,
              contextMeta: context.meta,
              reliability: {
                ...execution.reliability,
                turnLatencyMs,
                contextCompactions,
                contextOverflowAttempts: context.meta.overflowAttempts
              },
              provider: execution.result.provider,
              model: execution.result.model
            };
          }
        );
      } finally {
        cancellationWatch?.stop();
        await cancellationStore.clearCancellationRequest(request.sessionId);
        await cancellationStore.clearRunActive(request.sessionId);
        await lock.release();
      }
    },
    attachEvidence(label: string, content: string | unknown | ArrayBuffer | Uint8Array, type: RuntimeEvidenceType): void {
      const scope = evidenceContext.getStore();
      if (!scope) {
        throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence can only be called while a run is active.");
      }
      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence label must be non-empty.");
      }
      if (type !== "text" && type !== "json" && type !== "binary") {
        throw new AthenaError("CONFIG_ERROR", `runtime.attachEvidence type is unsupported: ${type}`);
      }
      scope.evidenceCount += 1;
      const normalizedContent = normalizeEvidenceContent(type, content);
      const attachment: RuntimeEvidenceAttachment = {
        sessionId: scope.sessionId,
        runId: scope.runId,
        traceId: scope.traceId,
        metadata: { ...scope.metadata },
        label: normalizedLabel,
        type,
        content: normalizedContent
      };
      if (!scope.onAttachEvidence) {
        return;
      }
      void Promise.resolve()
        .then(async () => {
          await scope.onAttachEvidence?.(attachment);
        })
        .catch(() => {
          // Evidence capture is best-effort and must not fail the active run path.
        });
    }
  };
}

function normalizeEvidenceContent(type: RuntimeEvidenceType, content: string | unknown | ArrayBuffer | Uint8Array): string | unknown {
  if (type === "text") {
    if (typeof content !== "string") {
      throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence text content must be a string.");
    }
    return content;
  }
  if (type === "json") {
    if (typeof content === "string" || content instanceof Uint8Array || content instanceof ArrayBuffer) {
      throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence json content must be JSON-compatible data.");
    }
    return content;
  }
  if (content instanceof Uint8Array) {
    return Buffer.from(content).toString("base64");
  }
  if (content instanceof ArrayBuffer) {
    return Buffer.from(content).toString("base64");
  }
  throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence binary content must be Uint8Array or ArrayBuffer.");
}

function resolveProviderOrder(primary: string, fallbackOrder: string[]): string[] {
  const unique: string[] = [];
  for (const providerId of [primary, ...fallbackOrder]) {
    if (!providerId || unique.includes(providerId)) {
      continue;
    }
    unique.push(providerId);
  }
  return unique;
}

async function runWithProviderFallback(
  providers: ProviderRegistry,
  order: string[],
  request: RunRequest,
  maxAttempts: number,
  signal?: AbortSignal
): Promise<{
  result: RunResult;
  reliability: {
    providerAttempts: number;
    providerRetries: number;
    fallbackHops: number;
  };
}> {
  const failures: string[] = [];
  let hadRegisteredProvider = false;
  let providerAttempts = 0;
  let providerRetries = 0;

  for (const providerId of order) {
    const adapter = providers.get(providerId);
    if (!adapter) {
      failures.push(`${providerId}:not-registered`);
      continue;
    }
    hadRegisteredProvider = true;
    providerAttempts += 1;

    try {
      const result = await runWithRetry(
        () =>
          adapter.generate(
            { ...request, provider: providerId },
            signal ? { signal } : undefined
          ),
        maxAttempts,
        signal,
        () => {
          providerRetries += 1;
        }
      );
        return {
          result: {
            ...result,
            provider: providerId
          },
          reliability: {
            providerAttempts,
            providerRetries,
            fallbackHops: Math.max(0, providerAttempts - 1)
          }
        };
    } catch (error) {
      const athenaError = asAthenaError(error);
      failures.push(`${providerId}:${athenaError.code}`);
      if (!athenaError.retryable) {
        throw athenaError;
      }
    }
  }

  if (!hadRegisteredProvider) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `No usable provider found in order: ${order.join(", ")}`);
  }

  throw new AthenaError("PROVIDER_ERROR", `All providers failed: ${failures.join("; ")}`, true);
}

async function runWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  signal?: AbortSignal,
  onRetry?: () => void
): Promise<T> {
  let lastError: AthenaError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new AthenaError("RUN_TIMEOUT", "Run aborted");
    }
    try {
      return await operation();
    } catch (error) {
      const athenaError = asAthenaError(error);
      lastError = athenaError;

      if (!athenaError.retryable || attempt >= maxAttempts) {
        throw athenaError;
      }

      onRetry?.();
      await delay(attempt * 50);
    }
  }

  throw lastError ?? new AthenaError("PROVIDER_ERROR", "Failed to complete run after retries");
}

async function runWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
  upstreamSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", onAbort);
    }
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    try {
      return await operation(controller.signal);
    } finally {
      if (upstreamSignal) {
        upstreamSignal.removeEventListener("abort", onAbort);
      }
    }
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new AthenaError("RUN_TIMEOUT", message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", onAbort);
    }
  }
}

function buildContextWithRecovery(params: {
  initialStrategy: ContextStrategy;
  messages: ContextMessage[];
  maxChars: number;
  reserveChars: number;
  summaryMaxChars: number;
  maxToolResultChars: number;
  maxOverflowRetries: number;
}): { content: string; strategy: ContextStrategy; meta: ContextCompactionMetadata } {
  let strategy = params.initialStrategy;
  let messages = params.messages;
  let overflowAttempts = 0;
  const steps: ContextRecoveryStep[] = [];

  let context = compileContext({
    strategy,
    messages,
    maxChars: params.maxChars,
    reserveChars: params.reserveChars,
    summaryMaxChars: params.summaryMaxChars
  });
  const initialChars = context.stats.inputChars;

  while (context.stats.overflow) {
    if (overflowAttempts >= params.maxOverflowRetries) {
      throw new AthenaError(
        "CONTEXT_OVERFLOW",
        `Context overflow after ${overflowAttempts} recovery attempt(s): ${context.stats.outputChars} chars > ${context.stats.effectiveMaxChars}`
      );
    }
    overflowAttempts += 1;

    if (strategy !== "summary") {
      const before = context.stats.outputChars;
      strategy = "summary";
      context = compileContext({
        strategy,
        messages,
        maxChars: params.maxChars,
        reserveChars: params.reserveChars,
        summaryMaxChars: params.summaryMaxChars
      });
      steps.push({
        kind: "summary",
        applied: true,
        beforeChars: before,
        afterChars: context.stats.outputChars,
        details: "Retried context compilation with summary strategy."
      });
      continue;
    }

    const before = context.stats.outputChars;
    const truncation = truncateOversizedToolResults(messages, params.maxToolResultChars);
    if (truncation.truncatedCount <= 0) {
      steps.push({
        kind: "tool-result-truncation",
        applied: false,
        beforeChars: before,
        afterChars: before,
        details: "No oversized tool-result entries available for truncation."
      });
      throw new AthenaError(
        "CONTEXT_OVERFLOW",
        `Context overflow could not be recovered: ${context.stats.outputChars} chars > ${context.stats.effectiveMaxChars}`
      );
    }

    messages = truncation.messages;
    context = compileContext({
      strategy,
      messages,
      maxChars: params.maxChars,
      reserveChars: params.reserveChars,
      summaryMaxChars: params.summaryMaxChars
    });
    steps.push({
      kind: "tool-result-truncation",
      applied: true,
      beforeChars: before,
      afterChars: context.stats.outputChars,
      details: `Truncated ${truncation.truncatedCount} oversized tool-result message(s).`
    });
  }

  const meta: ContextCompactionMetadata = {
    initialStrategy: params.initialStrategy,
    finalStrategy: strategy,
    overflowRecovered: overflowAttempts > 0,
    overflowAttempts,
    initialChars,
    finalChars: context.stats.outputChars,
    effectiveMaxChars: context.stats.effectiveMaxChars,
    steps
  };

  return {
    content: context.content,
    strategy: context.strategy,
    meta
  };
}

function resolveContextConfig(config: AthenaConfig): {
  strategy: ContextStrategy;
  maxChars: number;
  reserveChars: number;
  maxOverflowRetries: number;
  summaryMaxChars: number;
  maxToolResultChars: number;
} {
  return {
    strategy: config.context?.strategy ?? "raw",
    maxChars: config.context?.maxChars ?? 32_000,
    reserveChars: config.context?.reserveChars ?? 2_000,
    maxOverflowRetries: config.context?.maxOverflowRetries ?? 2,
    summaryMaxChars: config.context?.summaryMaxChars ?? 2_400,
    maxToolResultChars: config.context?.maxToolResultChars ?? 12_000
  };
}

function buildContextMetadataMap(
  meta: ContextCompactionMetadata,
  reliability?: RunResult["reliability"],
  requestMetadata?: Record<string, string>
): Record<string, string> {
  return {
    contextInitialStrategy: meta.initialStrategy,
    contextFinalStrategy: meta.finalStrategy,
    contextOverflowRecovered: String(meta.overflowRecovered),
    contextOverflowAttempts: String(meta.overflowAttempts),
    contextInitialChars: String(meta.initialChars),
    contextFinalChars: String(meta.finalChars),
    contextEffectiveMaxChars: String(meta.effectiveMaxChars),
    contextRecoverySteps: JSON.stringify(meta.steps),
    ...(reliability
      ? {
          providerAttempts: String(reliability.providerAttempts),
          providerRetries: String(reliability.providerRetries),
          providerFallbackHops: String(reliability.fallbackHops),
          ...(typeof reliability.turnLatencyMs === "number"
            ? { turnLatencyMs: String(reliability.turnLatencyMs) }
            : {}),
          ...(typeof reliability.contextCompactions === "number"
            ? { contextCompactions: String(reliability.contextCompactions) }
            : {}),
          ...(typeof reliability.contextOverflowAttempts === "number"
            ? { contextOverflowAttempts: String(reliability.contextOverflowAttempts) }
            : {})
        }
      : {}),
    ...(requestMetadata
      ? Object.fromEntries(
          Object.entries(requestMetadata).map(([key, value]) => [`requestMeta.${key}`, value])
        )
      : {})
  };
}
