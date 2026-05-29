import { AthenaError } from "../../runtime/errors.js";
import type {
  ModelProviderConfigCreateRequest,
  ModelProviderConfigUpdateRequest,
  ModelProviderKind,
  ModelProviderSecretReference,
  ModelProviderSecretReferenceKind
} from "../../shared/contracts/model-providers.js";
import { optionalString, parseJsonObject, requireString } from "../validation.js";

export function parseModelProviderConfigCreateRequest(body: unknown): ModelProviderConfigCreateRequest {
  const row = parseJsonObject(body, "modelProviders.create");
  const id = optionalString(row, "id", "modelProviders.create");
  const baseUrl = optionalString(row, "baseUrl", "modelProviders.create");
  return {
    ...(id ? { id } : {}),
    name: requireString(row, "name", "modelProviders.create"),
    providerKind: parseProviderKind(row.providerKind, "modelProviders.create.providerKind"),
    ...(baseUrl ? { baseUrl } : {}),
    defaultModel: requireString(row, "defaultModel", "modelProviders.create"),
    secret: parseSecretReference(row.secret, "modelProviders.create.secret")
  };
}

export function parseModelProviderConfigUpdateRequest(body: unknown): ModelProviderConfigUpdateRequest {
  const row = parseJsonObject(body, "modelProviders.update");
  const providerKind = row.providerKind === undefined ? undefined : parseProviderKind(row.providerKind, "modelProviders.update.providerKind");
  const secret = row.secret === undefined ? undefined : parseSecretReference(row.secret, "modelProviders.update.secret");
  const id = optionalString(row, "id", "modelProviders.update");
  const name = optionalString(row, "name", "modelProviders.update");
  const baseUrl = optionalString(row, "baseUrl", "modelProviders.update");
  const defaultModel = optionalString(row, "defaultModel", "modelProviders.update");
  if (id) {
    throw new AthenaError("CONFIG_ERROR", "modelProviders.update.id cannot be changed.");
  }
  return {
    ...(name ? { name } : {}),
    ...(providerKind ? { providerKind } : {}),
    ...(baseUrl ? { baseUrl } : {}),
    ...(defaultModel ? { defaultModel } : {}),
    ...(secret ? { secret } : {})
  };
}

function parseProviderKind(value: unknown, context: string): ModelProviderKind {
  if (value !== "openai-compatible") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be openai-compatible.`);
  }
  return value;
}

function parseSecretReference(value: unknown, context: string): ModelProviderSecretReference {
  const row = parseJsonObject(value, context);
  const kind = parseSecretReferenceKind(row.kind, `${context}.kind`);
  return {
    kind,
    name: requireString(row, "name", context)
  };
}

function parseSecretReferenceKind(value: unknown, context: string): ModelProviderSecretReferenceKind {
  if (value !== "env" && value !== "local-file") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be env or local-file.`);
  }
  return value;
}
