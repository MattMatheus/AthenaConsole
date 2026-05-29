import { apiClient } from "../../services";
import type {
  ModelProviderConfig,
  ModelProviderConfigCreateRequest,
  ModelProviderConfigDeleteResult,
  ModelProviderConfigListResult,
  ModelProviderConfigUpdateRequest,
  ModelProviderConnectionTestResult,
  ModelProviderKind,
  ModelProviderSecretReferenceKind,
  ModelProviderSecretStatus,
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function providerKind(value: unknown): ModelProviderKind {
  return value === "openai-compatible" ? "openai-compatible" : "openai-compatible";
}

function secretKind(value: unknown): ModelProviderSecretReferenceKind {
  return value === "local-file" ? "local-file" : "env";
}

function secretStatus(value: unknown): ModelProviderSecretStatus {
  if (value === "configured" || value === "missing" || value === "invalid" || value === "unsupported") {
    return value;
  }
  return "invalid";
}

function parseProvider(value: unknown): ModelProviderConfig {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    throw new Error("Model provider payload is invalid.");
  }
  const secret = isRecord(value.secret) ? value.secret : {};
  const statusMessage = optionalString(value.statusMessage);
  return {
    id: value.id,
    name: value.name,
    providerKind: providerKind(value.providerKind),
    baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "",
    defaultModel: typeof value.defaultModel === "string" ? value.defaultModel : "",
    secret: {
      kind: secretKind(secret.kind),
      name: typeof secret.name === "string" ? secret.name : "",
      configured: Boolean(secret.configured),
    },
    status: secretStatus(value.status),
    ...(statusMessage ? { statusMessage } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseTestResult(value: unknown): ModelProviderConnectionTestResult {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("Model provider test payload is invalid.");
  }
  const secret = isRecord(value.secret) ? value.secret : {};
  return {
    id: value.id,
    status: secretStatus(value.status),
    message: typeof value.message === "string" ? value.message : "Provider test completed.",
    secret: {
      kind: secretKind(secret.kind),
      name: typeof secret.name === "string" ? secret.name : "",
      configured: Boolean(secret.configured),
    },
    testedAt: typeof value.testedAt === "string" ? value.testedAt : new Date(0).toISOString(),
  };
}

export async function fetchModelProviders(): Promise<ModelProviderConfigListResult> {
  const payload = await apiClient.get<unknown>("/v1/model-providers");
  if (!isRecord(payload) || !Array.isArray(payload.providers)) {
    throw new Error("Model provider list payload is invalid.");
  }
  return {
    providers: payload.providers.map(parseProvider),
    total: typeof payload.total === "number" ? payload.total : payload.providers.length,
  };
}

export async function createModelProvider(
  request: ModelProviderConfigCreateRequest,
): Promise<ModelProviderConfig> {
  return parseProvider(await apiClient.post<unknown>("/v1/model-providers", request));
}

export async function updateModelProvider(
  id: string,
  request: ModelProviderConfigUpdateRequest,
): Promise<ModelProviderConfig> {
  return parseProvider(await apiClient.put<unknown>(`/v1/model-providers/${encodeURIComponent(id)}`, request));
}

export async function deleteModelProvider(id: string): Promise<ModelProviderConfigDeleteResult> {
  return apiClient.delete<ModelProviderConfigDeleteResult>(`/v1/model-providers/${encodeURIComponent(id)}`);
}

export async function testModelProvider(id: string): Promise<ModelProviderConnectionTestResult> {
  return parseTestResult(await apiClient.post<unknown>(`/v1/model-providers/${encodeURIComponent(id)}/test`));
}
