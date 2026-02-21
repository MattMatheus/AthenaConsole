export const ATHENA_POLICY_LABEL_KEYS = {
  agentRole: "athena.dev/agent-role",
  runId: "athena.dev/run-id",
  sessionId: "athena.dev/session-id",
  controlPlane: "athena.dev/control-plane"
} as const;

export const ATHENA_POLICY_ANNOTATION_KEYS = {
  profile: "athena.dev/policy-profile",
  cleanupTtlSeconds: "athena.dev/cleanup-ttl-seconds"
} as const;

export interface PolicyWorkloadMetadata {
  schemaVersion: 1;
  labels: {
    "athena.dev/agent-role": string;
    "athena.dev/run-id": string;
    "athena.dev/session-id": string;
    "athena.dev/control-plane"?: "v1";
  };
  annotations?: {
    "athena.dev/policy-profile"?: string;
    "athena.dev/cleanup-ttl-seconds"?: string;
  };
}

export type PolicyEngine = "athena" | "kyverno";
export type PolicyRuleType = "concurrency" | "validate" | "mutate" | "generate";
export type PolicyDecisionType = "rejected" | "mutated" | "generated";

export interface PolicyK8sResourceRef {
  kind: string;
  name: string;
  namespace?: string;
  apiVersion?: string;
}

/**
 * Versioned machine-readable policy origin details. Kyverno fields are optional and
 * present when policy outcomes are sourced from admission control callbacks.
 */
export interface PolicyOriginDetails {
  schemaVersion: 1;
  engine: PolicyEngine;
  ruleType: PolicyRuleType;
  policyName?: string;
  ruleName?: string;
  failureAction?: "audit" | "enforce";
  resourceRef?: PolicyK8sResourceRef;
  message?: string;
}

/**
 * Versioned policy decision metadata attached to policy outcome events.
 */
export interface PolicyDecisionEventMetadata {
  schemaVersion: 1;
  decision: PolicyDecisionType;
  workload: PolicyWorkloadMetadata;
  origin?: PolicyOriginDetails;
}

export interface PolicyDocument {
  schemaVersion: number;
  updatedAt: string;
  maxConcurrentRuns?: number;
  defaultRunTimeoutMs?: number;
  defaultScheduleTimeoutMs?: number;
  retryBudgetPerRun?: number;
  costBudgetDailyUsd?: number;
}

export type RunRejectionReason = "max-concurrent-runs-exceeded" | "lock-acquisition-failed";

/**
 * Versioned machine-readable payload for run admission rejections.
 * This schema is intended to remain stable for API/telemetry consumers.
 */
export interface RunRejectionEvent {
  schemaVersion: 1;
  timestamp: string;
  policyType: "CONCURRENCY";
  limit: number;
  rejectedRunDetails: {
    sessionId: string;
    personaName?: string;
  };
  reason: RunRejectionReason;
  activeRuns: number;
  policy?: PolicyOriginDetails;
}

export interface PolicyConcurrencyRejectionRecord {
  id: string;
  createdAt: string;
  sessionId: string;
  activeRuns: number;
  maxConcurrentRuns: number;
  reason: RunRejectionReason;
  policy?: PolicyOriginDetails;
  event: RunRejectionEvent;
}

export interface PolicyConcurrencyRejectionQuery {
  cursor?: string;
  limit?: number;
  sessionId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface PolicyConcurrencyRejectionQueryResult {
  items: PolicyConcurrencyRejectionRecord[];
  nextCursor?: string;
}
