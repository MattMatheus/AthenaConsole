export type HarnessProfileVersion = "v1" | "v2";

export interface HarnessEgressRule {
  host: string;
  port?: number;
}

export interface HarnessProfileConfig {
  provider: string;
  model: string;
  tools: string[];
}

export interface HarnessProfilePolicies {
  timeoutMs: number;
  retryLimit: number;
  budgetUsd: number;
}

export interface RequireEvidenceVerificationPolicy {
  id: string;
  kind: "require-evidence";
  label: string;
  evidenceType?: "text" | "json" | "binary";
}

export type HarnessVerificationPolicy = RequireEvidenceVerificationPolicy;

export interface VerificationPolicyFailure {
  policyId: string;
  kind: HarnessVerificationPolicy["kind"];
  message: string;
  details?: Record<string, string>;
}

export interface HarnessProfile {
  id: string;
  displayName: string;
  version: HarnessProfileVersion;
  config: HarnessProfileConfig;
  policies: HarnessProfilePolicies;
  allowedEgress?: HarnessEgressRule[];
  verificationPolicies?: HarnessVerificationPolicy[];
  createdAt: string;
}

export interface HarnessProfileCreateRequest {
  displayName: string;
  version: HarnessProfileVersion;
  config: HarnessProfileConfig;
  policies: HarnessProfilePolicies;
  allowedEgress?: HarnessEgressRule[];
  verificationPolicies?: HarnessVerificationPolicy[];
}

export interface HarnessProfileListQuery {
  cursor?: string;
  limit?: number;
}

export interface HarnessProfileListResult {
  items: HarnessProfile[];
  nextCursor?: string;
}
