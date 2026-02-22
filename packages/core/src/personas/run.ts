import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { LspService } from "../control-plane/interfaces.js";
import type { AthenaConfig } from "../shared/config.js";
import { createRuntime } from "../runtime/index.js";
import { loadPersonaDefinition } from "./loader.js";
import { assemblePersonaContextPack, type PersonaContextPack } from "./context-pack.js";
import {
  assertCleanWorktree,
  assertGitRepo,
  assertRefExists,
  getDiff,
  listChangedFiles,
  resolveBaseRef
} from "./git.js";
import { inspectDependenciesBestEffort } from "./dependency-inspection.js";
import { collectReferencedFileSnapshots } from "./referenced-snapshots.js";
import {
  persistPersonaRunArtifacts,
  persistPersonaRunEvidenceBundle,
  resolvePersonaRunPaths,
  resolveWorkspaceRelative,
  type PersonaEvidenceAttachment
} from "./persona-store.js";
import { resolvePersonaToolset } from "../tools/index.js";
import type {
  DependencyInspection,
  PersonaDefinition,
  PersonaModelOutputV1,
  PersonaEvidenceManifestEntry,
  PersonaRunResult,
  PersonaOutputStdout,
  ReferencedFileSnapshot
} from "./types.js";
import type { RuntimeEvidenceAttachment } from "../runtime/index.js";

const PERSONA_RUN_SCHEMA_VERSION = 1;
const MODEL_OUTPUT_REPAIR_MAX_CHARS = 40_000;

function safeId(prefix: string): string {
  const ts = Date.now();
  const rand = randomUUID().slice(0, 8);
  return `${prefix}-${ts}-${rand}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(1, Math.max(0, num));
}

export function validateModelOutputFindings(parsed: PersonaModelOutputV1): { findings?: PersonaModelOutputV1["findings"]; error?: string } {
  if (!Array.isArray(parsed.findings)) {
    return { error: "Model output missing findings array." };
  }
  for (const finding of parsed.findings) {
    if (!finding || typeof finding !== "object") {
      return { error: "Model output findings contained a non-object entry." };
    }
    if (!("priority" in finding) || !("confidence" in finding) || !("title" in finding) || !("message" in finding)) {
      return { error: "Model output finding missing required fields." };
    }
    const priority = (finding as { priority: unknown }).priority;
    if (priority !== "P1" && priority !== "P2" && priority !== "P3") {
      return { error: "Model output finding priority must be one of P1|P2|P3." };
    }
    if (typeof (finding as { title: unknown }).title !== "string" || typeof (finding as { message: unknown }).message !== "string") {
      return { error: "Model output finding title/message must be strings." };
    }
    const confidence = (finding as { confidence: unknown }).confidence;
    if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
      return { error: "Model output finding confidence must be a finite number." };
    }
  }

  const findings = parsed.findings.map((finding) => ({
    ...finding,
    confidence: clampConfidence((finding as { confidence: unknown }).confidence)
  }));
  const hasP1 = findings.some((finding) => finding.priority === "P1");
  if (hasP1 && parsed.mergeGate !== "fail") {
    return { error: "Model output mergeGate must be 'fail' when any P1 finding exists." };
  }
  return { findings };
}

function parsePersonaModelOutput(raw: string): { parsed?: PersonaModelOutputV1; error?: string } {
  try {
    const parsed = JSON.parse(raw) as PersonaModelOutputV1;
    if (!parsed || typeof parsed !== "object") {
      return { error: "Model output was not a JSON object." };
    }
    if (parsed.schemaVersion !== 1) {
      return { error: "Model output schemaVersion missing or unsupported." };
    }
    if (parsed.mergeGate !== "pass" && parsed.mergeGate !== "fail") {
      return { error: "Model output missing mergeGate ('pass'|'fail')." };
    }
    if (typeof parsed.reportMarkdown !== "string") {
      return { error: "Model output missing reportMarkdown string." };
    }
    const findingsValidation = validateModelOutputFindings(parsed);
    if (findingsValidation.error) {
      return { error: findingsValidation.error };
    }
    parsed.findings = findingsValidation.findings ?? [];
    return { parsed };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function buildRepairPrompt(rawOutput: string, parseError: string): string {
  return [
    "Your previous response was invalid JSON for the required schema.",
    `Validation error: ${parseError}`,
    "Return ONLY strict JSON (no markdown fences, no commentary) that conforms exactly to:",
    JSON.stringify(
      {
        schemaVersion: 1,
        mergeGate: "pass|fail",
        reportMarkdown: "string",
        findings: [
          {
            priority: "P1|P2|P3",
            confidence: 0.0,
            title: "short title",
            message: "one paragraph explanation",
            suggestion: "optional concrete suggestion",
            file: "optional path",
            line: 0
          }
        ],
        dependencyInspection: {
          status: "ok|skipped",
          notes: ["optional notes"]
        }
      },
      null,
      2
    ),
    "",
    "Constraint: mergeGate MUST be 'fail' when any finding priority is P1.",
    "",
    "Previous invalid response:",
    rawOutput.slice(0, MODEL_OUTPUT_REPAIR_MAX_CHARS),
    ...(rawOutput.length > MODEL_OUTPUT_REPAIR_MAX_CHARS ? [`\n[truncated to ${MODEL_OUTPUT_REPAIR_MAX_CHARS} chars]\n`] : [])
  ].join("\n");
}

function buildReviewPrompt(options: {
  personaContextSystem: string;
  personaContextUser: string;
  contextManifestSummary: string;
  availableTools: Array<{ name: string; description: string }>;
  persona: PersonaDefinition;
  repoPath: string;
  headRef: string;
  baseRef: string;
  changedFiles: string[];
  diff: string;
  dependencyInspection: unknown;
  referencedFileContext: string;
}): string {
  const rubric = options.persona.review?.rubric ?? {
    correctness: true,
    security: true,
    performance: true,
    maintainability: true,
    testGaps: true
  };
  const reviewScope = options.persona.review?.scope ?? "diff";
  const isImplementationScope = reviewScope === "implementation";
  const systemRole = isImplementationScope ? "Athena's implementation specialist." : "Athena's code review persona.";
  const modeRule = isImplementationScope
    ? "- Perform implementation directly using available tools; do not stay in review-only mode when actionable work exists."
    : "- Suggestions only. Do not claim to have applied changes.";
  const priorityRule = isImplementationScope
    ? "- Use priority P1 for blocked or missing required delivery; P2 for partial acceptance coverage; P3 for minor follow-ups."
    : "- Use priority P1 for critical correctness/security issues; P2 for important maintainability/test gaps; P3 for nits/nice-to-haves.";
  const reportRule = isImplementationScope
    ? "- reportMarkdown must describe implementation status, files changed (or still required), tests run, and handoff readiness."
    : undefined;

  return [
    "SYSTEM:",
    `You are ${systemRole}`,
    "Return ONLY strict JSON that conforms to this schema (no markdown outside JSON):",
    JSON.stringify(
      {
        schemaVersion: 1,
        mergeGate: "pass|fail",
        reportMarkdown: "string (Markdown report for humans)",
        findings: [
          {
            priority: "P1|P2|P3",
            confidence: 0.0,
            title: "short title",
            message: "one paragraph explanation",
            suggestion: "optional concrete suggestion",
            file: "optional path",
            line: 0
          }
        ],
        dependencyInspection: {
          status: "ok|skipped",
          notes: ["optional notes"]
        }
      },
      null,
      2
    ),
    "",
    "Rules:",
    modeRule,
    priorityRule,
    "- Confidence must be a float in [0,1].",
    "- mergeGate MUST be 'fail' when any P1 finding exists.",
    "- If dependency inspection cannot be performed, set dependencyInspection.status='skipped' and explain in notes.",
    ...(reportRule ? [reportRule] : []),
    "",
    "Curated persona context manifest summary:",
    options.contextManifestSummary,
    "",
    ...(options.personaContextSystem
      ? ["Curated system context (prompt + skill files, ordered):", options.personaContextSystem, ""]
      : []),
    "Available tools:",
    ...(options.availableTools.length > 0
      ? options.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`)
      : ["(none)"]),
    "",
    "USER:",
    `Repo: ${options.repoPath}`,
    `Compare: ${options.baseRef}..${options.headRef}`,
    "",
    ...(options.personaContextUser ? ["Curated user context (doc files, ordered):", options.personaContextUser, ""] : []),
    "Rubric toggles:",
    JSON.stringify(rubric, null, 2),
    "",
    "Changed files (bounded):",
    options.changedFiles.join("\n") || "(none)",
    "",
    "Dependency/import inspection context (best-effort):",
    JSON.stringify(options.dependencyInspection, null, 2),
    "",
    "Referenced TS/JS file snapshots from newly introduced relative imports (bounded):",
    options.referencedFileContext || "(none)",
    "",
    "Diff (may be truncated):",
    options.diff
  ].join("\n");
}

export interface PersonaRunRequest {
  name: string;
  repoPath: string;
  headRef: string;
  baseRef?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  outJsonPath?: string;
  outMarkdownPath?: string;
  stdout?: PersonaOutputStdout;
}

export interface PersonaRunPreflightResult {
  persona: PersonaDefinition;
  repoPath: string;
  baseResolution: {
    baseRef: string;
    resolvedFrom: "flag" | "main" | "origin-head";
  };
}

export interface PersonaReviewPromptInput {
  persona: PersonaDefinition;
  contextPack: PersonaContextPack;
  repoPath: string;
  headRef: string;
  baseRef: string;
  changedFiles: string[];
  diff: string;
  dependencyInspection: unknown;
  referencedSnapshots: ReferencedFileSnapshot[];
}

export interface PersonaRuntimeRunResult {
  output: string;
  provider: string;
  model: string;
  createdAt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  reliability?: unknown;
  contextMeta?: unknown;
}

export interface PersonaRuntimeRunner {
  run(request: {
    sessionId: string;
    input: string;
    provider?: string;
    model?: string;
    metadata: Record<string, string>;
  }): Promise<PersonaRuntimeRunResult>;
}

export interface PersonaModelExecutionInput {
  runtime: PersonaRuntimeRunner;
  sessionId: string;
  prompt: string;
  personaName: string;
  repoPath: string;
  provider?: string;
  model?: string;
}

export interface PersonaModelExecutionResult {
  runtimeResult?: PersonaRuntimeRunResult;
  modelOutputRaw: string;
  status: PersonaRunResult["status"];
  topError?: PersonaRunResult["error"];
  parseRetryAttempted: boolean;
  parsed: { parsed?: PersonaModelOutputV1; error?: string };
}

export interface PersonaOutputNormalizationInput {
  execution: PersonaModelExecutionResult;
  dependencyInspection: DependencyInspection;
}

export interface PersonaOutputNormalizationResult {
  reportMarkdown: string;
  findings: PersonaModelOutputV1["findings"];
  mergeGate: "pass" | "fail";
  dependencyInspection: DependencyInspection;
  modelOutputRaw: string;
  modelOutputParsed: boolean;
  parseRetryAttempted: boolean;
  parseError?: string;
}

export interface PersistPersonaRunArtifactsInput {
  config: AthenaConfig;
  runId: string;
  personaResult: PersonaRunResult;
  reportMarkdown: string;
  outJsonPath?: string;
  outMarkdownPath?: string;
  persistFn?: typeof persistPersonaRunArtifacts;
}

export interface PersonaRunExecutionPreparation {
  contextPack: PersonaContextPack;
  diff: string;
  changedFiles: string[];
  dependencyInspection: DependencyInspection;
  referenced: {
    meta: PersonaRunResult["referencedFileMeta"];
    snapshots: ReferencedFileSnapshot[];
  };
}

const PERSONA_REVIEW_DIFF_MAX_CHARS = 18_000;
const PERSONA_REVIEW_CHANGED_FILES_MAX = 300;

export interface BuildPersonaRunResultInput {
  request: PersonaRunRequest;
  runId: string;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  preflight: PersonaRunPreflightResult;
  executionPreparation: PersonaRunExecutionPreparation;
  execution: PersonaModelExecutionResult;
  normalization: PersonaOutputNormalizationResult;
  evidenceManifest: PersonaEvidenceManifestEntry[];
  config: AthenaConfig;
}

export interface PersonaRunOrchestratorDependencies {
  runPreflightChecks: typeof runPreflightChecks;
  assemblePersonaContextPack: typeof assemblePersonaContextPack;
  getDiff: typeof getDiff;
  listChangedFiles: typeof listChangedFiles;
  inspectDependenciesBestEffort: typeof inspectDependenciesBestEffort;
  collectReferencedFileSnapshots: typeof collectReferencedFileSnapshots;
  createRuntime: typeof createRuntime;
  constructPersonaReviewPrompt: typeof constructPersonaReviewPrompt;
  executeModelWithRepair: typeof executeModelWithRepair;
  normalizePersonaOutput: typeof normalizePersonaOutput;
  resolvePersonaRunPaths: typeof resolvePersonaRunPaths;
  resolveWorkspaceRelative: typeof resolveWorkspaceRelative;
  persistPersonaRunEvidenceBundle: typeof persistPersonaRunEvidenceBundle;
  persistPersonaRunResultArtifacts: typeof persistPersonaRunResultArtifacts;
  nowIso(): string;
  buildSafeId(prefix: string): string;
  lspService?: LspService;
}

interface PersonaEvidenceCollector {
  capture(attachment: RuntimeEvidenceAttachment): Promise<void>;
  flush(): Promise<PersonaEvidenceAttachment[]>;
}

function cloneRuntimeEvidenceAttachment(attachment: RuntimeEvidenceAttachment): RuntimeEvidenceAttachment {
  return {
    sessionId: attachment.sessionId,
    runId: attachment.runId,
    traceId: attachment.traceId,
    metadata: { ...attachment.metadata },
    label: attachment.label,
    type: attachment.type,
    content: attachment.content
  };
}

function createPersonaEvidenceCollector(nowIso: () => string): PersonaEvidenceCollector {
  const attachments: PersonaEvidenceAttachment[] = [];
  const pending = new Set<Promise<void>>();

  return {
    capture(attachment: RuntimeEvidenceAttachment): Promise<void> {
      const task = Promise.resolve().then(() => {
        const snapshot = cloneRuntimeEvidenceAttachment(attachment);
        attachments.push({
          sessionId: snapshot.sessionId,
          runtimeRunId: snapshot.runId,
          traceId: snapshot.traceId,
          label: snapshot.label,
          type: snapshot.type,
          content: snapshot.content,
          metadata: snapshot.metadata,
          capturedAt: nowIso()
        });
      });
      pending.add(task);
      void task.finally(() => pending.delete(task));
      return task;
    },
    async flush(): Promise<PersonaEvidenceAttachment[]> {
      await Promise.resolve();
      await Promise.allSettled(Array.from(pending));
      return attachments.map((attachment) => ({
        ...attachment,
        ...(attachment.metadata ? { metadata: { ...attachment.metadata } } : {})
      }));
    }
  };
}

function buildReferencedFileContext(snapshots: ReferencedFileSnapshot[]): string {
  return (
    snapshots
      .map((snapshot) =>
        [
          `---`,
          `from: ${snapshot.sourcePath}`,
          `import: ${snapshot.importSpecifier}`,
          `resolved: ${snapshot.path}`,
          `truncated: ${snapshot.truncated}`,
          snapshot.content
        ].join("\n")
      )
      .join("\n\n") || "(none)"
  );
}

export function constructPersonaReviewPrompt(options: PersonaReviewPromptInput): string {
  const manifestSummary = JSON.stringify(
    {
      schemaVersion: options.contextPack.manifest.schemaVersion,
      personaId: options.contextPack.manifest.personaId,
      totals: options.contextPack.manifest.totals,
      limits: options.contextPack.manifest.limits
    },
    null,
    2
  );

  return buildReviewPrompt({
    personaContextSystem: options.contextPack.systemContent,
    personaContextUser: options.contextPack.userContent,
    contextManifestSummary: manifestSummary,
    availableTools: resolvePersonaToolset(options.persona),
    persona: options.persona,
    repoPath: options.repoPath,
    headRef: options.headRef,
    baseRef: options.baseRef,
    changedFiles: options.changedFiles,
    diff: options.diff,
    dependencyInspection: options.dependencyInspection,
    referencedFileContext: buildReferencedFileContext(options.referencedSnapshots)
  });
}

export async function executeModelWithRepair(options: PersonaModelExecutionInput): Promise<PersonaModelExecutionResult> {
  let runtimeResult: PersonaRuntimeRunResult | undefined;
  let modelOutputRaw = "";
  let status: PersonaRunResult["status"] = "ok";
  let topError: PersonaRunResult["error"] | undefined;
  let parseRetryAttempted = false;

  try {
    runtimeResult = await options.runtime.run({
      sessionId: options.sessionId,
      input: options.prompt,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      metadata: {
        trigger: "persona:run",
        specialist: options.personaName,
        persona: options.personaName,
        repoPath: options.repoPath
      }
    });
    modelOutputRaw = runtimeResult.output;
  } catch (error) {
    status = "failed";
    modelOutputRaw = error instanceof Error ? error.message : String(error);
    topError = { message: modelOutputRaw };
  }

  let parsed = parsePersonaModelOutput(modelOutputRaw);
  if (status === "ok" && !parsed.parsed) {
    parseRetryAttempted = true;
    try {
      const repaired = await options.runtime.run({
        sessionId: options.sessionId,
        input: buildRepairPrompt(modelOutputRaw, parsed.error ?? "Invalid model output."),
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
        metadata: {
          trigger: "persona:repair-json",
          specialist: options.personaName,
          persona: options.personaName,
          repoPath: options.repoPath
        }
      });
      runtimeResult = repaired;
      modelOutputRaw = repaired.output;
      parsed = parsePersonaModelOutput(modelOutputRaw);
    } catch (error) {
      status = "failed";
      const message = `Repair retry failed: ${error instanceof Error ? error.message : String(error)}`;
      topError = { message };
      modelOutputRaw = message;
      parsed = { error: message };
    }
  }

  if (status === "ok" && !parsed.parsed) {
    status = "failed";
    topError = { message: `Failed to produce schema-valid code-review JSON output: ${parsed.error ?? "Unknown parse failure."}` };
  }

  return {
    ...(runtimeResult ? { runtimeResult } : {}),
    modelOutputRaw,
    status,
    ...(topError ? { topError } : {}),
    parseRetryAttempted,
    parsed
  };
}

export function normalizePersonaOutput(options: PersonaOutputNormalizationInput): PersonaOutputNormalizationResult {
  const { execution, dependencyInspection } = options;
  const reportMarkdown = execution.parsed.parsed?.reportMarkdown ?? execution.modelOutputRaw;
  const findings = execution.parsed.parsed?.findings ?? [];
  const mergeGate: "pass" | "fail" =
    execution.parsed.parsed?.mergeGate ?? (findings.some((finding) => finding.priority === "P1") ? "fail" : "pass");

  // Let the model override dependencyInspection status/notes, but keep computed signals for context.
  const mergedDependencyInspection: DependencyInspection = {
    ...dependencyInspection,
    ...(execution.parsed.parsed?.dependencyInspection?.status ? { status: execution.parsed.parsed.dependencyInspection.status } : {}),
    ...(execution.parsed.parsed?.dependencyInspection?.notes ? { notes: execution.parsed.parsed.dependencyInspection.notes } : {})
  };

  return {
    reportMarkdown,
    findings,
    mergeGate,
    dependencyInspection: mergedDependencyInspection,
    modelOutputRaw: execution.modelOutputRaw,
    modelOutputParsed: Boolean(execution.parsed.parsed),
    parseRetryAttempted: execution.parseRetryAttempted,
    ...(execution.parsed.error ? { parseError: execution.parsed.error } : {})
  };
}

export async function persistPersonaRunResultArtifacts(options: PersistPersonaRunArtifactsInput): Promise<void> {
  const persist = options.persistFn ?? persistPersonaRunArtifacts;
  await persist({
    config: options.config,
    runId: options.runId,
    jsonPayload: `${JSON.stringify(options.personaResult, null, 2)}\n`,
    markdownPayload: `${options.reportMarkdown.trimEnd()}\n`,
    ...(options.outJsonPath ? { outJsonPath: options.outJsonPath } : {}),
    ...(options.outMarkdownPath ? { outMarkdownPath: options.outMarkdownPath } : {})
  });
}

export async function runPreflightChecks(
  request: PersonaRunRequest,
  workspaceRoot: string,
  options: {
    stateDir?: string;
  } = {}
): Promise<PersonaRunPreflightResult> {
  const persona = await loadPersonaDefinition(workspaceRoot, request.name);
  const repoPath = resolve(workspaceRoot, request.repoPath);

  await assertGitRepo(repoPath);
  if (persona.git?.requireCleanWorktree ?? true) {
    await assertCleanWorktree(repoPath, {
      excludePaths: options.stateDir ? [options.stateDir] : []
    });
  }

  const baseResolution = await resolveBaseRef({
    repoPath,
    defaultBaseRef: persona.git?.baseRefDefault ?? "main",
    allowAutodetect: persona.git?.baseRefAutodetect ?? true,
    ...(request.baseRef ? { baseRefFlag: request.baseRef } : {})
  });

  await assertRefExists(repoPath, baseResolution.baseRef);
  await assertRefExists(repoPath, request.headRef);

  return {
    persona,
    repoPath,
    baseResolution
  };
}

const DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES: PersonaRunOrchestratorDependencies = {
  runPreflightChecks,
  assemblePersonaContextPack,
  getDiff,
  listChangedFiles,
  inspectDependenciesBestEffort,
  collectReferencedFileSnapshots,
  createRuntime,
  constructPersonaReviewPrompt,
  executeModelWithRepair,
  normalizePersonaOutput,
  resolvePersonaRunPaths,
  resolveWorkspaceRelative,
  persistPersonaRunEvidenceBundle,
  persistPersonaRunResultArtifacts,
  nowIso: () => new Date().toISOString(),
  buildSafeId: safeId
};

export async function preparePersonaRunExecution(
  request: PersonaRunRequest,
  config: AthenaConfig,
  preflight: PersonaRunPreflightResult,
  dependencies: PersonaRunOrchestratorDependencies
): Promise<PersonaRunExecutionPreparation> {
  const { persona, repoPath, baseResolution } = preflight;
  const contextPack = await dependencies.assemblePersonaContextPack({
    workspaceRoot: config.workspaceRoot,
    persona
  });
  const diff = await dependencies.getDiff(repoPath, baseResolution.baseRef, request.headRef, PERSONA_REVIEW_DIFF_MAX_CHARS);
  const changedFiles = await dependencies.listChangedFiles(
    repoPath,
    baseResolution.baseRef,
    request.headRef,
    PERSONA_REVIEW_CHANGED_FILES_MAX
  );
  const dependencyInspection = await dependencies.inspectDependenciesBestEffort({
    repoPath,
    headRef: request.headRef,
    changedFiles,
    diff
  });
  const referenced = await dependencies.collectReferencedFileSnapshots({
    repoPath,
    headRef: request.headRef,
    diff,
    ...(config.context?.strategy ? { contextStrategy: config.context.strategy } : {}),
    ...(dependencies.lspService ? { lspService: dependencies.lspService } : {}),
    ...(persona.review?.maxReferencedFiles !== undefined ? { maxReferencedFiles: persona.review.maxReferencedFiles } : {}),
    ...(persona.review?.maxReferencedFileChars !== undefined
      ? { maxReferencedFileChars: persona.review.maxReferencedFileChars }
      : {})
  });

  return {
    contextPack,
    diff,
    changedFiles,
    dependencyInspection,
    referenced
  };
}

export function buildPersonaRunResult(options: BuildPersonaRunResultInput): PersonaRunResult {
  const { request, preflight, executionPreparation, execution, normalization, config } = options;
  const { runtimeResult, topError } = execution;
  const { repoPath, baseResolution } = preflight;
  const { contextPack, referenced } = executionPreparation;
  const { reportMarkdown, findings, mergeGate, dependencyInspection, modelOutputRaw, modelOutputParsed, parseRetryAttempted, parseError } =
    normalization;

  const auditPaths = resolvePersonaRunPaths(config, options.runId);
  const outJsonAbs = request.outJsonPath ? resolveWorkspaceRelative(config.workspaceRoot, request.outJsonPath) : undefined;
  const outMdAbs = request.outMarkdownPath ? resolveWorkspaceRelative(config.workspaceRoot, request.outMarkdownPath) : undefined;

  return {
    schemaVersion: PERSONA_RUN_SCHEMA_VERSION,
    runId: options.runId,
    personaName: request.name,
    specialistName: request.name,
    sessionId: options.sessionId,
    repoPath,
    headRef: request.headRef,
    baseRef: baseResolution.baseRef,
    baseRefResolvedFrom: baseResolution.resolvedFrom,
    status: execution.status,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    artifacts: {
      auditDir: auditPaths.auditDir,
      resultJsonPath: auditPaths.resultJsonPath,
      reportMarkdownPath: auditPaths.reportMarkdownPath,
      ...(outJsonAbs ? { outJsonPath: outJsonAbs } : {}),
      ...(outMdAbs ? { outMarkdownPath: outMdAbs } : {})
    },
    contextManifest: contextPack.manifest,
    referencedFileMeta: referenced.meta,
    referencedFileSnapshots: referenced.snapshots,
    evidenceManifest: options.evidenceManifest.map((entry) => ({ ...entry })),
    dependencyInspection,
    findings,
    mergeGate,
    ...(runtimeResult?.usage ? { usage: runtimeResult.usage } : {}),
    ...(runtimeResult?.contextMeta ? { contextMeta: runtimeResult.contextMeta } : {}),
    reportMarkdown,
    modelOutputRaw,
    modelOutputParsed,
    parseRetryAttempted,
    ...(parseError ? { parseError } : {}),
    ...(runtimeResult
      ? {
          runtimeResult: {
            provider: runtimeResult.provider,
            model: runtimeResult.model,
            createdAt: runtimeResult.createdAt,
            ...(runtimeResult.usage ? { usage: runtimeResult.usage } : {}),
            ...(runtimeResult.reliability ? { reliability: runtimeResult.reliability } : {}),
            ...(runtimeResult.contextMeta ? { contextMeta: runtimeResult.contextMeta } : {})
          }
        }
      : {}),
    ...(topError ? { error: topError } : {}),
  };
}

export function renderPersonaRunStdout(
  request: PersonaRunRequest,
  personaResult: PersonaRunResult,
  persona: PersonaDefinition
): string {
  const stdoutMode = request.stdout ?? persona.output?.stdoutDefault ?? "summary";
  if (stdoutMode === "none") {
    return "";
  }
  if (stdoutMode === "json") {
    return JSON.stringify(personaResult, null, 2);
  }
  if (stdoutMode === "md") {
    return personaResult.reportMarkdown;
  }

  const summaryLines = [
    `specialist: ${request.name}`,
    `runId: ${personaResult.runId}`,
    `status: ${personaResult.status}`,
    `compare: ${personaResult.baseRef}..${personaResult.headRef}`,
    `evidence: ${personaResult.evidenceManifest.length}`,
    `result.json: ${personaResult.artifacts.resultJsonPath}`,
    `report.md: ${personaResult.artifacts.reportMarkdownPath}`,
    ...(personaResult.parseError ? [`parseError: ${personaResult.parseError}`] : [])
  ];
  return summaryLines.join("\n");
}

export async function runPersonaOrchestrator(
  request: PersonaRunRequest,
  config: AthenaConfig,
  dependencies: PersonaRunOrchestratorDependencies = DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES
): Promise<{ result: PersonaRunResult; stdout: string }> {
  const preflight = await dependencies.runPreflightChecks(request, config.workspaceRoot, {
    stateDir: config.stateDir
  });
  const executionPreparation = await preparePersonaRunExecution(request, config, preflight, dependencies);
  const startedAt = dependencies.nowIso();
  const runId = dependencies.buildSafeId(`persona-${request.name}`);
  const sessionId = request.sessionId ?? dependencies.buildSafeId(`session-${request.name}`);
  const evidenceCollector = createPersonaEvidenceCollector(dependencies.nowIso);

  const prompt = dependencies.constructPersonaReviewPrompt({
    persona: preflight.persona,
    contextPack: executionPreparation.contextPack,
    repoPath: preflight.repoPath,
    headRef: request.headRef,
    baseRef: preflight.baseResolution.baseRef,
    changedFiles: executionPreparation.changedFiles,
    diff: executionPreparation.diff,
    dependencyInspection: executionPreparation.dependencyInspection,
    referencedSnapshots: executionPreparation.referenced.snapshots
  });
  const runtime = dependencies.createRuntime({ config });
  const runtimeWithEvidenceCapture: PersonaRuntimeRunner = {
    run: (runRequest) =>
      runtime.run(runRequest, {
        onAttachEvidence: async (attachment) => {
          await evidenceCollector.capture(attachment);
        }
      })
  };
  const execution = await dependencies.executeModelWithRepair({
    runtime: runtimeWithEvidenceCapture,
    sessionId,
    prompt,
    personaName: request.name,
    repoPath: preflight.repoPath,
    ...(request.provider ? { provider: request.provider } : {}),
    ...(request.model ? { model: request.model } : {})
  });
  const normalization = dependencies.normalizePersonaOutput({
    execution,
    dependencyInspection: executionPreparation.dependencyInspection
  });
  const capturedEvidence = await evidenceCollector.flush();
  const evidenceManifest = await dependencies.persistPersonaRunEvidenceBundle({
    config,
    runId,
    attachments: capturedEvidence
  });
  const finishedAt = dependencies.nowIso();
  const result = buildPersonaRunResult({
    request,
    runId,
    sessionId,
    startedAt,
    finishedAt,
    preflight,
    executionPreparation,
    execution,
    normalization,
    evidenceManifest,
    config
  });

  await dependencies.persistPersonaRunResultArtifacts({
    config,
    runId,
    personaResult: result,
    reportMarkdown: normalization.reportMarkdown,
    ...(request.outJsonPath ? { outJsonPath: request.outJsonPath } : {}),
    ...(request.outMarkdownPath ? { outMarkdownPath: request.outMarkdownPath } : {})
  });

  return {
    result,
    stdout: renderPersonaRunStdout(request, result, preflight.persona)
  };
}

export async function runPersona(
  request: PersonaRunRequest,
  config: AthenaConfig,
  options: { lspService?: LspService } = {}
): Promise<{ result: PersonaRunResult; stdout: string }> {
  if (!options.lspService) {
    return runPersonaOrchestrator(request, config);
  }
  return runPersonaOrchestrator(request, config, {
    ...DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES,
    lspService: options.lspService
  });
}

export type SpecialistRunRequest = PersonaRunRequest;
export type SpecialistRunPreflightResult = PersonaRunPreflightResult;
export type SpecialistReviewPromptInput = PersonaReviewPromptInput;
export type SpecialistRuntimeRunResult = PersonaRuntimeRunResult;
export type SpecialistRuntimeRunner = PersonaRuntimeRunner;
export type SpecialistModelExecutionInput = PersonaModelExecutionInput;
export type SpecialistModelExecutionResult = PersonaModelExecutionResult;
export type BuildSpecialistRunResultInput = BuildPersonaRunResultInput;
export type SpecialistRunOrchestratorDependencies = PersonaRunOrchestratorDependencies;
export type SpecialistRunExecutionPreparation = PersonaRunExecutionPreparation;
export type PersistSpecialistRunArtifactsInput = PersistPersonaRunArtifactsInput;

export const persistSpecialistRunResultArtifacts = persistPersonaRunResultArtifacts;
export const runSpecialistOrchestrator = runPersonaOrchestrator;
export const runSpecialist = runPersona;
export const constructSpecialistReviewPrompt = constructPersonaReviewPrompt;
export const renderSpecialistRunStdout = renderPersonaRunStdout;
