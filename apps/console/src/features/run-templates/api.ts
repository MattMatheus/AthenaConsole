import { apiClient } from "../../services";
import type {
  HarnessProfile,
  HarnessProfileListResult,
  RunTemplate,
  RunTemplateCreateRequest,
  RunTemplateListResult,
  RunTemplateResult,
  TemplateRunRequest,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function parseRunTemplate(value: unknown): RunTemplate {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.harnessProfileId !== "string") {
    throw new Error("Run template payload is invalid.");
  }
  return {
    id: value.id,
    harnessProfileId: value.harnessProfileId,
    directiveTemplate: typeof value.directiveTemplate === "string" ? value.directiveTemplate : "",
    defaultParams: toStringRecord(value.defaultParams),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function parseHarnessProfile(value: unknown): HarnessProfile {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Harness profile payload is invalid.");
  }
  const config = isRecord(value.config) ? value.config : {};
  return {
    id: value.id,
    displayName: typeof value.displayName === "string" ? value.displayName : value.id,
    version: value.version === "v2" ? "v2" : "v1",
    config: {
      provider: typeof config.provider === "string" ? config.provider : "",
      model: typeof config.model === "string" ? config.model : "",
      tools: Array.isArray(config.tools) ? config.tools.filter((item): item is string => typeof item === "string") : [],
    },
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function parseRunTemplateResult(value: unknown): RunTemplateResult {
  if (!isRecord(value) || typeof value.sessionId !== "string") {
    throw new Error("Run template result payload is invalid.");
  }
  const template = isRecord(value.template) ? value.template : undefined;
  return {
    sessionId: value.sessionId,
    output: typeof value.output === "string" ? value.output : "",
    model: typeof value.model === "string" ? value.model : "",
    provider: typeof value.provider === "string" ? value.provider : "",
    ...(typeof value.runId === "string" ? { runId: value.runId } : {}),
    ...(typeof value.directiveId === "string" ? { directiveId: value.directiveId } : {}),
    ...(typeof value.harnessProfileId === "string" ? { harnessProfileId: value.harnessProfileId } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    ...(template && typeof template.id === "string" && typeof template.harnessProfileId === "string"
      ? {
          template: {
            id: template.id,
            harnessProfileId: template.harnessProfileId,
            effectiveParams: toStringRecord(template.effectiveParams),
          },
        }
      : {}),
  };
}

export async function fetchRunTemplates(): Promise<RunTemplateListResult> {
  const value = await apiClient.get<unknown>("/v1/run-templates?limit=100");
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Run template list payload is invalid.");
  }
  return {
    items: value.items.map(parseRunTemplate),
    ...(typeof value.nextCursor === "string" ? { nextCursor: value.nextCursor } : {}),
  };
}

export async function createRunTemplate(request: RunTemplateCreateRequest): Promise<RunTemplate> {
  return parseRunTemplate(await apiClient.post<unknown>("/v1/run-templates", request));
}

export async function runTemplate(id: string, request: TemplateRunRequest): Promise<RunTemplateResult> {
  return parseRunTemplateResult(await apiClient.post<unknown>(`/v1/templates/${encodeURIComponent(id)}/run`, request));
}

export async function fetchHarnessProfiles(): Promise<HarnessProfileListResult> {
  const value = await apiClient.get<unknown>("/v1/harness-profiles?limit=100");
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Harness profile list payload is invalid.");
  }
  return {
    items: value.items.map(parseHarnessProfile),
    ...(typeof value.nextCursor === "string" ? { nextCursor: value.nextCursor } : {}),
  };
}
