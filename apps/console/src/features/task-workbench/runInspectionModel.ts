import type {
  TaskWorkbenchArtifactMetadata,
  TaskWorkbenchRunEvent,
  TaskWorkbenchRunStatus,
  TaskWorkbenchVerificationFailure,
  TaskWorkbenchVerificationStatus,
} from "./types";

export type RunEventKind = "log" | "artifact" | "lifecycle";
export type RunStatusTone = "neutral" | "running" | "success" | "danger" | "warning";
export type VerificationStatusTone = "neutral" | "success" | "danger";

export type ProposedChangeArtifact = {
  summary: string;
  applyAvailable: boolean;
  changes: Array<{
    path: string;
    changeType: string;
    diff: string;
  }>;
};

export type ModelProviderRunMetadata = {
  providerId?: string;
  providerKind?: string;
  baseUrl?: string;
  model?: string;
};

export type ModelRunOutput = {
  providerId?: string;
  providerKind?: string;
  model?: string;
  response?: string;
  responseMarkdown?: string;
  usage?: unknown;
};

export type ArtifactPreviewState = {
  status: "available" | "metadata-only" | "unsupported" | "blocked";
  label: string;
  description: string;
  canOpen: boolean;
};

export function classifyRunEvent(event: Pick<TaskWorkbenchRunEvent, "type">): RunEventKind {
  if (event.type === "run.log") {
    return "log";
  }
  if (event.type.startsWith("artifact.")) {
    return "artifact";
  }
  return "lifecycle";
}

export function runStatusTone(status: TaskWorkbenchRunStatus): RunStatusTone {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed" || status === "cancelled" || status === "stopped-by-limit") {
    return "danger";
  }
  if (status === "waiting-for-approval") {
    return "warning";
  }
  if (status === "running" || status === "validating") {
    return "running";
  }
  return "neutral";
}

export function verificationStatusLabel(status: TaskWorkbenchVerificationStatus | undefined): string {
  if (status === "passed") {
    return "passed";
  }
  if (status === "verification-failed") {
    return "verification failed";
  }
  return "not evaluated";
}

export function verificationStatusTone(status: TaskWorkbenchVerificationStatus | undefined): VerificationStatusTone {
  if (status === "passed") {
    return "success";
  }
  if (status === "verification-failed") {
    return "danger";
  }
  return "neutral";
}

export function formatVerificationFailureDetails(failure: Pick<TaskWorkbenchVerificationFailure, "details">): string {
  if (!failure.details || Object.keys(failure.details).length === 0) {
    return "No details recorded.";
  }
  return Object.entries(failure.details)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export function formatUnknown(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

export function formatBytes(value: number | undefined): string {
  if (value === undefined) {
    return "not recorded";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function isProposedChangeArtifact(artifact: Pick<TaskWorkbenchArtifactMetadata, "kind" | "format" | "metadata">): boolean {
  const metadata = asRecord(artifact.metadata);
  return (
    artifact.kind === "proposed-change" ||
    artifact.kind === "proposed-changes" ||
    artifact.format === "diff" ||
    artifact.format === "patch" ||
    metadata?.artifactType === "proposed-change" ||
    metadata?.artifactType === "proposed-changes"
  );
}

export function artifactPreviewState(
  artifact: Pick<TaskWorkbenchArtifactMetadata, "storageUri" | "format" | "metadata">,
): ArtifactPreviewState {
  const metadata = asRecord(artifact.metadata);
  if (metadata?.previewAvailable === false || metadata?.contentAvailable === false || metadata?.metadataOnly === true) {
    return {
      status: "metadata-only",
      label: "Metadata only",
      description: "This artifact recorded metadata, but no preview payload was saved.",
      canOpen: false,
    };
  }

  const storageUri = artifact.storageUri.trim();
  if (storageUri.startsWith("memory://")) {
    if (storageUri.includes("/../") || storageUri.endsWith("/..")) {
      return {
        status: "blocked",
        label: "Preview blocked",
        description: "This memory artifact path is outside the supported preview boundary.",
        canOpen: false,
      };
    }
    return {
      status: "available",
      label: "Preview available",
      description: "Open this artifact to preview content recorded with the task output.",
      canOpen: true,
    };
  }

  if (storageUri.startsWith("file://")) {
    return {
      status: "blocked",
      label: "Preview blocked",
      description: "Absolute file artifacts are blocked unless they resolve inside the producing plugin boundary.",
      canOpen: true,
    };
  }

  if (storageUri.includes(":")) {
    const scheme = storageUri.split(":", 1)[0] || "unknown";
    return {
      status: "unsupported",
      label: "Unsupported preview",
      description: `Preview is not available for ${scheme} artifact storage.`,
      canOpen: false,
    };
  }

  if (storageUri.startsWith("../") || storageUri.includes("/../") || storageUri === ".." || storageUri.endsWith("/..")) {
    return {
      status: "blocked",
      label: "Preview blocked",
      description: "This artifact path is outside the producing plugin artifacts directory.",
      canOpen: true,
    };
  }

  if (artifact.format === "binary") {
    return {
      status: "unsupported",
      label: "Unsupported preview",
      description: "Binary artifact previews are not supported yet.",
      canOpen: false,
    };
  }

  return {
    status: "available",
    label: "Preview available",
    description: "Open this artifact to preview file-backed content.",
    canOpen: true,
  };
}

export function proposedChangeArtifact(artifact: Pick<TaskWorkbenchArtifactMetadata, "metadata">): ProposedChangeArtifact {
  const metadata = asRecord(artifact.metadata) ?? {};
  const rawChanges = Array.isArray(metadata.proposedChanges)
    ? metadata.proposedChanges
    : Array.isArray(metadata.changes)
      ? metadata.changes
      : [];
  return {
    summary: typeof metadata.summary === "string" ? metadata.summary : "Proposed file changes are available for review.",
    applyAvailable: metadata.applyAvailable === true,
    changes: rawChanges.map(normalizeProposedChange).filter((change): change is ProposedChangeArtifact["changes"][number] => Boolean(change)),
  };
}

export function modelProviderRunMetadata(events: Array<Pick<TaskWorkbenchRunEvent, "type" | "payload">>): ModelProviderRunMetadata | undefined {
  const event = events.find((item) => item.type === "run.model_provider");
  const payload = event ? asRecord(event.payload) : undefined;
  if (!payload) {
    return undefined;
  }
  const metadata: ModelProviderRunMetadata = {
    ...(typeof payload.providerId === "string" ? { providerId: payload.providerId } : {}),
    ...(typeof payload.providerKind === "string" ? { providerKind: payload.providerKind } : {}),
    ...(typeof payload.baseUrl === "string" ? { baseUrl: payload.baseUrl } : {}),
    ...(typeof payload.model === "string" ? { model: payload.model } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function modelRunOutput(value: unknown): ModelRunOutput | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const output: ModelRunOutput = {
    ...(typeof record.providerId === "string" ? { providerId: record.providerId } : {}),
    ...(typeof record.providerKind === "string" ? { providerKind: record.providerKind } : {}),
    ...(typeof record.model === "string" ? { model: record.model } : {}),
    ...(typeof record.response === "string" ? { response: record.response } : {}),
    ...(typeof record.responseMarkdown === "string" ? { responseMarkdown: record.responseMarkdown } : {}),
    ...(record.usage !== undefined ? { usage: record.usage } : {}),
  };
  return output.response || output.responseMarkdown || output.model || output.providerId ? output : undefined;
}

function normalizeProposedChange(value: unknown): ProposedChangeArtifact["changes"][number] | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const path = typeof record.path === "string" ? record.path : typeof record.file === "string" ? record.file : undefined;
  if (!path) {
    return undefined;
  }
  return {
    path,
    changeType: typeof record.changeType === "string" ? record.changeType : typeof record.type === "string" ? record.type : "modify",
    diff: typeof record.diff === "string" ? record.diff : "",
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
