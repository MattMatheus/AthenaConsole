import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import { trackOperationEvent } from "../../observability/application-insights.js";
import { assertValidSessionId } from "../../runtime/session-store.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  Directive,
  HarnessProfile,
  HarnessVerificationPolicy,
  RunRequest,
  RunResult,
  VerificationPolicyFailure,
  WorkflowRun
} from "../../shared/contracts.js";
import type { ExecutionBackend, RuntimeEvidenceAttachment } from "../backends.js";
import type { EventService, RunService } from "../interfaces.js";
import type { RunEvidenceRecord, RunEvidenceType, StateStore } from "../state-store.js";

export class LocalRunService implements RunService {
  constructor(
    private readonly backend: ExecutionBackend,
    private readonly stateStore: StateStore,
    private readonly config: AthenaConfig,
    private readonly eventService: EventService
  ) {}

  async run(request: RunRequest, options?: Parameters<ExecutionBackend["run"]>[1]): Promise<RunResult> {
    const resolved = await this.resolveRunRequest(request);
    const startedAt = Date.now();
    const result = await this.backend.run(
      {
        sessionId: request.sessionId,
        input: resolved.directive.input,
        provider: resolved.harnessProfile.config.provider,
        model: resolved.harnessProfile.config.model,
        ...(request.maxOutputTokens !== undefined ? { maxOutputTokens: request.maxOutputTokens } : {}),
        metadata: {
          ...(request.metadata ?? {}),
          directiveId: resolved.directive.id,
          harnessProfileId: resolved.harnessProfile.id,
          directiveShadow: String(resolved.directiveShadow),
          harnessProfileShadow: String(resolved.harnessProfileShadow),
          harnessProfileSnapshot: JSON.stringify(resolved.harnessProfile),
          ...(resolved.harnessProfile.allowedEgress && resolved.harnessProfile.allowedEgress.length > 0
            ? { sandboxAllowedEgress: serializeAllowedEgress(resolved.harnessProfile.allowedEgress) }
            : {})
        }
      },
      {
        ...(options ?? {}),
        onAttachEvidence: async (attachment) => {
          await this.handleRuntimeEvidenceAttachment(attachment);
          if (options?.onAttachEvidence) {
            await options.onAttachEvidence(attachment);
          }
        }
      }
    );
    const runResult: RunResult = {
      ...result,
      directiveId: resolved.directive.id,
      harnessProfileId: resolved.harnessProfile.id,
      harnessProfileSnapshot: cloneHarnessProfile(resolved.harnessProfile)
    };
    trackOperationEvent(
      "athena.ai.model.response",
      {
        runId: runResult.runId,
        specialistId:
          request.metadata?.specialistId ??
          request.metadata?.specialistName ??
          request.metadata?.specialist ??
          request.metadata?.personaId ??
          request.metadata?.personaName ??
          request.metadata?.persona,
        personaId:
          request.metadata?.specialistId ??
          request.metadata?.specialistName ??
          request.metadata?.specialist ??
          request.metadata?.personaId ??
          request.metadata?.personaName ??
          request.metadata?.persona,
        tenantId: request.metadata?.tenantId,
        provider: runResult.provider,
        model: runResult.model
      },
      {
        latencyMs: Date.now() - startedAt
      }
    );
    const verified = await this.applyVerificationPolicies(runResult, resolved.harnessProfile);
    await this.emitRunCompletedEvent(verified, resolved.harnessProfile.id);
    return verified;
  }

  cancel(request: Parameters<ExecutionBackend["cancel"]>[0]) {
    return this.backend.cancel(request);
  }

  async cancelByRunId(request: { runId: string; reason?: string }) {
    if (this.backend.cancelByRunId) {
      return this.backend.cancelByRunId(request);
    }
    if (!this.backend.listActiveRuns) {
      return {
        runId: request.runId,
        status: "not-running" as const
      };
    }
    const active = await this.backend.listActiveRuns({
      runId: request.runId,
      limit: 1
    });
    const match = active.items[0];
    if (!match) {
      return {
        runId: request.runId,
        status: "not-running" as const
      };
    }
    const cancelled = await this.backend.cancel({
      sessionId: match.sessionId,
      ...(request.reason ? { reason: request.reason } : {})
    });
    return {
      runId: request.runId,
      status: cancelled.status,
      sessionId: cancelled.sessionId
    };
  }

  listActiveRuns(query?: Parameters<NonNullable<ExecutionBackend["listActiveRuns"]>>[0]) {
    if (!this.backend.listActiveRuns) {
      return Promise.resolve({ items: [] });
    }
    return this.backend.listActiveRuns(query);
  }

  listCancellationRequests(query?: Parameters<NonNullable<ExecutionBackend["listCancellationRequests"]>>[0]) {
    if (!this.backend.listCancellationRequests) {
      return Promise.resolve({ items: [] });
    }
    return this.backend.listCancellationRequests(query);
  }

  private async resolveRunRequest(request: RunRequest): Promise<{
    directive: Directive;
    directiveShadow: boolean;
    harnessProfile: HarnessProfile;
    harnessProfileShadow: boolean;
  }> {
    if (!request.sessionId.trim()) {
      throw new AthenaError("CONFIG_ERROR", "sessionId is required");
    }
    assertValidSessionId(request.sessionId);
    if (request.input && request.directiveId) {
      throw new AthenaError("CONFIG_ERROR", "runs.create.input cannot be combined with directiveId.");
    }
    if (request.harnessProfileId && (request.provider || request.model)) {
      throw new AthenaError("CONFIG_ERROR", "runs.create.provider/model cannot be combined with harnessProfileId.");
    }
    const directive = await this.resolveDirective(request);
    const harnessProfile = await this.resolveHarnessProfile(request);
    return {
      directive: directive.directive,
      directiveShadow: directive.shadow,
      harnessProfile: harnessProfile.harnessProfile,
      harnessProfileShadow: harnessProfile.shadow
    };
  }

  private async resolveDirective(request: RunRequest): Promise<{ directive: Directive; shadow: boolean }> {
    if (request.directiveId) {
      const directives = await this.stateStore.listDirectives();
      const directive = directives.find((row) => row.id === request.directiveId);
      if (!directive) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `runs.create.directiveId must reference an existing directive. Received: ${request.directiveId}.`
        );
      }
      return {
        directive,
        shadow: false
      };
    }
    if (!request.input?.trim()) {
      throw new AthenaError("CONFIG_ERROR", "runs.create requires either input or directiveId.");
    }
    return {
      directive: await this.stateStore.createDirective({
        input: request.input.trim(),
        metadata: {
          source: "run-service",
          shadow: "true"
        }
      }),
      shadow: true
    };
  }

  private async resolveHarnessProfile(request: RunRequest): Promise<{ harnessProfile: HarnessProfile; shadow: boolean }> {
    if (request.harnessProfileId) {
      const profiles = await this.stateStore.listHarnessProfiles();
      const profile = profiles.find((row) => row.id === request.harnessProfileId);
      if (!profile) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `runs.create.harnessProfileId must reference an existing harness profile. Received: ${request.harnessProfileId}.`
        );
      }
      return {
        harnessProfile: profile,
        shadow: false
      };
    }

    return {
      harnessProfile: {
        id: `shadow-harness-${randomUUID().slice(0, 12)}`,
        displayName: "Shadow Harness Profile",
        version: "v1",
        config: {
          provider: request.provider ?? this.config.defaultProvider,
          model: request.model ?? this.config.defaultModel,
          tools: ["shadow-directive"]
        },
        policies: {
          timeoutMs: this.config.runtimeRunTimeoutMs,
          retryLimit: 1,
          budgetUsd: 0
        },
        createdAt: new Date().toISOString()
      },
      shadow: true
    };
  }

  private async handleRuntimeEvidenceAttachment(attachment: RuntimeEvidenceAttachment): Promise<void> {
    if (!this.backend.listActiveRuns) {
      throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence requires an execution backend with active-run visibility.");
    }
    const active = await this.backend.listActiveRuns({
      runId: attachment.runId,
      limit: 1
    });
    const run = active.items.find((item) => item.runId === attachment.runId);
    if (!run || run.sessionId !== attachment.sessionId) {
      throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence is only allowed for active runs.");
    }
    if (!isRunEvidenceType(attachment.type)) {
      throw new AthenaError("CONFIG_ERROR", `runtime.attachEvidence type is unsupported: ${attachment.type}`);
    }
    const evidence = await this.stateStore.createRunEvidence({
      sessionId: attachment.sessionId,
      runId: attachment.runId,
      traceId: attachment.traceId,
      label: attachment.label,
      type: attachment.type,
      content: attachment.content
    });
    const workflowId = attachment.metadata.workflowId;
    const workflowRunId = attachment.metadata.workflowRunId;
    const workflowStepId = attachment.metadata.workflowStepId;
    if (!workflowId || !workflowRunId || !workflowStepId) {
      return;
    }
    await this.stateStore.transitionWorkflowRun(workflowId, workflowRunId, (snapshot) => {
      if (snapshot.status !== "running") {
        throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence is only allowed while workflow runs are active.");
      }
      const state = snapshot.stepStates[workflowStepId];
      if (!state || state.status !== "running") {
        throw new AthenaError("CONFIG_ERROR", "runtime.attachEvidence is only allowed while workflow steps are active.");
      }
      const now = new Date().toISOString();
      return {
        ...snapshot,
        executionLog: [
          ...snapshot.executionLog,
          makeWorkflowRunLogEntry(
            "info",
            `Evidence attached: ${evidence.id} (${evidence.type}) label=${evidence.label} ref=${evidence.artifactRef}`,
            workflowStepId
          )
        ],
        updatedAt: now
      };
    });
  }

  private async emitRunCompletedEvent(result: RunResult, harnessProfileId: string): Promise<void> {
    try {
      await this.eventService.emit({
        type: "run.completed",
        sessionId: result.sessionId,
        ...(result.runId ? { runId: result.runId } : {}),
        payload: {
          provider: result.provider,
          model: result.model,
          harnessProfileId,
          ...(result.usage
            ? {
                usage: {
                  ...(typeof result.usage.inputTokens === "number" ? { inputTokens: result.usage.inputTokens } : {}),
                  ...(typeof result.usage.outputTokens === "number" ? { outputTokens: result.usage.outputTokens } : {}),
                  ...(typeof result.usage.totalTokens === "number" ? { totalTokens: result.usage.totalTokens } : {})
                }
              }
            : {})
        }
      });
    } catch {
      // Observability should never alter run completion behavior.
    }
  }

  private async applyVerificationPolicies(result: RunResult, harnessProfile: HarnessProfile): Promise<RunResult> {
    const policies = harnessProfile.verificationPolicies;
    if (!policies || policies.length === 0) {
      return {
        ...result,
        verificationStatus: "passed"
      };
    }
    const runId = this.resolveRunId(result);
    const evidence = runId ? await this.stateStore.listRunEvidence(runId) : [];
    const failures = evaluateVerificationPolicies(policies, evidence);
    return {
      ...result,
      verificationStatus: failures.length > 0 ? "verification-failed" : "passed",
      ...(failures.length > 0 ? { verificationFailures: failures } : {})
    };
  }

  private resolveRunId(result: RunResult): string | undefined {
    const runId = result.runId;
    return typeof runId === "string" && runId.trim().length > 0 ? runId : undefined;
  }
}

function isRunEvidenceType(value: string): value is RunEvidenceType {
  return value === "text" || value === "json" || value === "binary";
}

function cloneHarnessProfile(profile: HarnessProfile): HarnessProfile {
  return {
    ...profile,
    config: {
      ...profile.config,
      tools: [...profile.config.tools]
    },
    policies: {
      ...profile.policies
    },
    ...(profile.verificationPolicies
      ? {
          verificationPolicies: profile.verificationPolicies.map((policy) => ({ ...policy }))
        }
      : {}),
    ...(profile.allowedEgress
      ? {
          allowedEgress: profile.allowedEgress.map((rule) => ({
            host: rule.host,
            ...(rule.port !== undefined ? { port: rule.port } : {})
          }))
        }
      : {})
  };
}

function serializeAllowedEgress(allowedEgress: NonNullable<HarnessProfile["allowedEgress"]>): string {
  return allowedEgress
    .map((rule) => `${rule.host}${rule.port !== undefined ? `:${rule.port}` : ""}`)
    .join(",");
}

function evaluateVerificationPolicies(
  policies: HarnessVerificationPolicy[],
  evidence: RunEvidenceRecord[]
): VerificationPolicyFailure[] {
  const failures: VerificationPolicyFailure[] = [];
  for (const policy of policies) {
    if (policy.kind === "require-evidence") {
      const matching = evidence.filter(
        (record) =>
          record.label === policy.label &&
          (policy.evidenceType === undefined || record.type === policy.evidenceType)
      );
      if (matching.length === 0) {
        failures.push({
          policyId: policy.id,
          kind: policy.kind,
          message: `Required evidence was not found for label '${policy.label}'.`,
          details: {
            label: policy.label,
            ...(policy.evidenceType ? { evidenceType: policy.evidenceType } : {})
          }
        });
        continue;
      }
      const firstNonEmpty = matching.find((record) => isEvidenceRecordNonEmpty(record));
      if (!firstNonEmpty) {
        failures.push({
          policyId: policy.id,
          kind: policy.kind,
          message: `Required evidence was present but empty for label '${policy.label}'.`,
          details: {
            label: policy.label,
            ...(policy.evidenceType ? { evidenceType: policy.evidenceType } : {})
          }
        });
      }
    }
  }
  return failures;
}

function isEvidenceRecordNonEmpty(record: RunEvidenceRecord): boolean {
  if (record.sizeBytes <= 0) {
    return false;
  }
  if (record.content.kind === "text") {
    return record.content.text.trim().length > 0;
  }
  if (record.content.kind === "binary") {
    return record.content.base64.trim().length > 0;
  }
  return record.content.value !== undefined && record.content.value !== null;
}

function makeWorkflowRunLogEntry(
  level: "info" | "error",
  message: string,
  stepId?: string
): WorkflowRun["executionLog"][number] {
  return {
    id: randomUUID(),
    level,
    message,
    createdAt: new Date().toISOString(),
    ...(stepId ? { stepId } : {})
  };
}
