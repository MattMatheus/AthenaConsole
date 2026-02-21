import type { PolicyDecisionEventMetadata } from "./policy.js";

export type SandboxLifecyclePhase =
  | "claiming"
  | "claimed"
  | "ready"
  | "ready-timeout"
  | "fallback"
  | "required-unavailable"
  | "terminating"
  | "cleaned"
  | "cleanup-failed";

export type RuntimeIsolationProfile = "standard" | "high-security";
export type RuntimeIsolationStartMode = "warm" | "cold";

/**
 * Versioned machine-readable sandbox lifecycle metadata attached to events.
 * Optional for backward compatibility; emitted on sandbox-routed run orchestration paths.
 */
export interface SandboxLifecycleEventMetadata {
  schemaVersion: 1;
  backend: "agent-sandbox";
  phase: SandboxLifecyclePhase;
  isolationProfile?: RuntimeIsolationProfile;
  startMode?: RuntimeIsolationStartMode;
  runtimeClassName?: string;
  templateRef?: string;
  warmPoolRef?: string;
  sandboxId?: string;
  claimName?: string;
  namespace?: string;
  latencyMsStartup?: number;
  latencyMsClaimToReady?: number;
  reason?: string;
}

export interface EventRecord {
  id: string;
  traceId: string;
  type: string;
  createdAt: string;
  sessionId?: string;
  runId?: string;
  taskId?: string;
  parentRunId?: string;
  sandbox?: SandboxLifecycleEventMetadata;
  policy?: PolicyDecisionEventMetadata;
  payload: Record<string, unknown>;
}

export interface EventQuery {
  cursor?: string;
  limit?: number;
  traceId?: string;
  sessionId?: string;
  types?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface EventQueryResult {
  events: EventRecord[];
  nextCursor?: string;
}

export interface EventEmitRequest {
  traceId?: string;
  type: string;
  sessionId?: string;
  runId?: string;
  taskId?: string;
  parentRunId?: string;
  sandbox?: SandboxLifecycleEventMetadata;
  policy?: PolicyDecisionEventMetadata;
  payload: Record<string, unknown>;
}
