export type EvalSuiteStatus = "draft" | "active" | "archived";
export type EvalRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type EvalResultStatus = "passed" | "failed" | "errored" | "skipped";

export interface EvalFailureDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface EvalSuiteRecord {
  id: string;
  name: string;
  description: string;
  status: EvalSuiteStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRunRecord {
  id: string;
  suiteId: string;
  sourceRunId?: string;
  agentId: string;
  agentVersion: string;
  providerId?: string;
  providerKind?: string;
  model?: string;
  promptTemplateId?: string;
  promptTemplateVersion?: string;
  promptTemplateHash: string;
  status: EvalRunStatus;
  startedAt?: string;
  finishedAt?: string;
  failure?: EvalFailureDetail;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface EvalResultRecord {
  id: string;
  evalRunId: string;
  caseId: string;
  status: EvalResultStatus;
  score?: number;
  expectedArtifactUri?: string;
  actualArtifactUri?: string;
  failure?: EvalFailureDetail;
  metrics: unknown;
  metadata: unknown;
  createdAt: string;
}
