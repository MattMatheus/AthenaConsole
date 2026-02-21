import type { ContextCompactionMetadata } from "./context.js";
import type { HarnessProfile, VerificationPolicyFailure } from "./harness.js";

export interface RunRequest {
  sessionId: string;
  input?: string;
  directiveId?: string;
  harnessProfileId?: string;
  model?: string;
  provider?: string;
  maxOutputTokens?: number;
  metadata?: Record<string, string>;
}

export interface RunResult {
  sessionId: string;
  output: string;
  model: string;
  provider: string;
  runId?: string;
  evidenceCount?: number;
  verificationStatus?: "passed" | "verification-failed";
  verificationFailures?: VerificationPolicyFailure[];
  directiveId?: string;
  harnessProfileId?: string;
  harnessProfileSnapshot?: HarnessProfile;
  template?: {
    id: string;
    harnessProfileId: string;
    effectiveParams: Record<string, string>;
  };
  contextMeta?: ContextCompactionMetadata;
  reliability?: {
    providerAttempts: number;
    providerRetries: number;
    fallbackHops: number;
    turnLatencyMs?: number;
    contextCompactions?: number;
    contextOverflowAttempts?: number;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  createdAt: string;
}

export interface CancelRunRequest {
  sessionId: string;
  reason?: string;
}

export interface CancelRunResult {
  sessionId: string;
  status: "cancelled" | "not-running";
}

export interface CancelRunByRunIdRequest {
  runId: string;
  reason?: string;
}

export interface CancelRunByRunIdResult {
  runId: string;
  status: "cancelled" | "not-running";
  sessionId?: string;
}

export interface ActiveRunRecord {
  sessionId: string;
  pid: number;
  startedAt: string;
  runId: string;
  traceId?: string;
}

export interface CancellationRequestRecord {
  sessionId: string;
  requestedAt: string;
  reason?: string;
  runId: string;
  traceId?: string;
  startedAt?: string;
}

export interface RunControlQuery {
  cursor?: string;
  limit?: number;
  sessionId?: string;
  runId?: string;
}

export interface ActiveRunQueryResult {
  items: ActiveRunRecord[];
  nextCursor?: string;
}

export interface CancellationRequestQueryResult {
  items: CancellationRequestRecord[];
  nextCursor?: string;
}
