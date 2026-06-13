import type { DurableMemoryNamespaceRef, DurableMemoryProposal, DurableMemoryRecord } from "./durable-memory.js";
import type {
  TaskWorkbenchArtifactMetadata,
  TaskWorkbenchRunEvent,
  TaskWorkbenchTask,
  TaskWorkbenchTaskRun
} from "./task-workbench.js";

export const EVIDENCE_BUNDLE_SCHEMA_VERSION = "team-orchestrator.evidence-bundle.v1" as const;
export const EVIDENCE_BUNDLE_REDACTION_TEXT = "[redacted]" as const;

export type EvidenceBundleSchemaVersion = typeof EVIDENCE_BUNDLE_SCHEMA_VERSION;
export type EvidenceBundleChecksumAlgorithm = "sha256";
export type EvidenceBundlePayloadKind = "inline-text" | "inline-json" | "artifact-ref" | "external-ref" | "unavailable";

export interface EvidenceBundleChecksum {
  algorithm: EvidenceBundleChecksumAlgorithm;
  value: string;
}

export interface EvidenceBundleManifest {
  schemaVersion: EvidenceBundleSchemaVersion;
  bundleId: string;
  createdAt: string;
  createdBy?: string;
  source: {
    product: "team-orchestrator";
    version?: string;
    workspaceId?: string;
  };
  run: EvidenceBundleRunMetadata;
  redaction: EvidenceBundleRedactionReport;
  checksums: {
    manifest: EvidenceBundleChecksum;
    entries: EvidenceBundleChecksum[];
  };
}

export interface EvidenceBundleRunMetadata {
  run: TaskWorkbenchTaskRun;
  task?: TaskWorkbenchTask;
  workflow?: {
    runId?: string;
    templateId?: string;
    templateVersion?: string;
    missionId?: string;
    stepId?: string;
  };
  provider?: EvidenceBundleProviderMetadata;
  policy?: EvidenceBundlePolicyPack;
  usage?: EvidenceBundleUsage;
}

export interface EvidenceBundleProviderMetadata {
  providerId?: string;
  providerKind?: string;
  model?: string;
  baseUrl?: string;
  secretRef?: EvidenceBundleSecretReference;
  status?: string;
}

export interface EvidenceBundleSecretReference {
  kind: string;
  name: string;
  configured?: boolean;
}

export interface EvidenceBundlePolicyPack {
  runMode?: string;
  safetyStop?: unknown;
  verificationStatus?: string;
  verificationFailures?: unknown[];
  approvals?: EvidenceBundleApproval[];
}

export interface EvidenceBundleApproval {
  id: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  operation?: string;
  reason?: string;
}

export interface EvidenceBundleUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  providerUsage?: unknown;
}

export interface EvidenceBundleEventEntry {
  id: string;
  event: TaskWorkbenchRunEvent;
  checksum: EvidenceBundleChecksum;
}

export interface EvidenceBundleArtifactEntry {
  id: string;
  metadata: TaskWorkbenchArtifactMetadata;
  payload: EvidenceBundlePayloadRef;
  checksum: EvidenceBundleChecksum;
}

export interface EvidenceBundlePayloadRef {
  kind: EvidenceBundlePayloadKind;
  mediaType?: string;
  storageUri?: string;
  inline?: unknown;
  sizeBytes?: number;
  checksum?: EvidenceBundleChecksum;
  unavailableReason?: string;
}

export interface EvidenceBundleMemoryEntry {
  id: string;
  namespace?: DurableMemoryNamespaceRef;
  record?: EvidenceBundleMemoryRecord;
  proposal?: EvidenceBundleMemoryProposal;
  approval?: EvidenceBundleApproval;
  checksum: EvidenceBundleChecksum;
}

export type EvidenceBundleMemoryRecord = Omit<DurableMemoryRecord, "body"> & {
  bodyChecksum?: EvidenceBundleChecksum;
};

export type EvidenceBundleMemoryProposal = Omit<DurableMemoryProposal, "proposedBody"> & {
  proposedBodyChecksum?: EvidenceBundleChecksum;
};

export interface EvidenceBundleRedactionReport {
  strategy: "secret-key-recursive";
  redactedFields: string[];
}

export interface EvidenceBundle {
  manifest: EvidenceBundleManifest;
  events: EvidenceBundleEventEntry[];
  artifacts: EvidenceBundleArtifactEntry[];
  memory: EvidenceBundleMemoryEntry[];
}

const SECRET_KEY_PATTERN = /api[-_.]?key|authorization|bearer|credential|password|secret|secret[-_.]?ref|token/i;
const USAGE_TOKEN_COUNTER_PATTERN = /^(input|output|total|prompt|completion)[-_.]?tokens?$/i;

export function redactEvidenceBundleValue<T>(value: T): { value: T; report: EvidenceBundleRedactionReport } {
  const redactedFields: string[] = [];
  return {
    value: redactUnknown(value, "$", redactedFields) as T,
    report: {
      strategy: "secret-key-recursive",
      redactedFields
    }
  };
}

function redactUnknown(value: unknown, path: string, redactedFields: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactUnknown(item, `${path}[${index}]`, redactedFields));
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const nextPath = `${path}.${key}`;
      if (SECRET_KEY_PATTERN.test(key) && !USAGE_TOKEN_COUNTER_PATTERN.test(key)) {
        redactedFields.push(nextPath);
        return [key, EVIDENCE_BUNDLE_REDACTION_TEXT];
      }
      return [key, redactUnknown(entry, nextPath, redactedFields)];
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
