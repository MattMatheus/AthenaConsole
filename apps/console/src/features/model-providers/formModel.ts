import type {
  ModelProviderConfig,
  ModelProviderConfigCreateRequest,
  ModelProviderSecretReferenceKind,
  ModelProviderSecretStatus,
} from "./types";

export type ModelProviderFormDraft = {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  secretKind: ModelProviderSecretReferenceKind;
  secretName: string;
};

export type ModelProviderFormErrors = Partial<Record<keyof ModelProviderFormDraft, string>>;

export const DEFAULT_MODEL_PROVIDER_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_MODEL_PROVIDER_MODEL = "gpt-4.1-mini";

export function emptyModelProviderDraft(): ModelProviderFormDraft {
  return {
    id: "",
    name: "",
    baseUrl: DEFAULT_MODEL_PROVIDER_BASE_URL,
    defaultModel: DEFAULT_MODEL_PROVIDER_MODEL,
    secretKind: "env",
    secretName: "OPENAI_API_KEY",
  };
}

export function draftFromProvider(provider: ModelProviderConfig): ModelProviderFormDraft {
  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel,
    secretKind: provider.secret.kind,
    secretName: provider.secret.name,
  };
}

export function buildProviderCreateRequest(draft: ModelProviderFormDraft): {
  request?: ModelProviderConfigCreateRequest;
  errors: ModelProviderFormErrors;
} {
  const errors: ModelProviderFormErrors = {};
  const id = draft.id.trim();
  const name = draft.name.trim();
  const baseUrl = draft.baseUrl.trim();
  const defaultModel = draft.defaultModel.trim();
  const secretName = draft.secretName.trim();

  if (!name) {
    errors.name = "Provider name is required.";
  }
  if (!baseUrl) {
    errors.baseUrl = "Base URL is required.";
  }
  if (!defaultModel) {
    errors.defaultModel = "Default model is required.";
  }
  if (!secretName) {
    errors.secretName = draft.secretKind === "env" ? "Environment variable name is required." : "Secret file path is required.";
  }
  if (draft.secretKind === "local-file" && secretName && !secretName.startsWith("/")) {
    errors.secretName = "Local-file secret references must use an absolute path.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    request: {
      ...(id ? { id } : {}),
      name,
      providerKind: "openai-compatible",
      baseUrl,
      defaultModel,
      secret: {
        kind: draft.secretKind,
        name: secretName,
      },
    },
    errors,
  };
}

export function secretReferenceLabel(kind: ModelProviderSecretReferenceKind, name: string): string {
  return kind === "env" ? `env:${name}` : `file:${name}`;
}

export function modelProviderStatusTone(status: ModelProviderSecretStatus): "ready" | "degraded" | "failed" {
  if (status === "configured") {
    return "ready";
  }
  if (status === "missing") {
    return "degraded";
  }
  return "failed";
}
