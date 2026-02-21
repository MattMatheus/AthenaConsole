import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import { DefaultAzureCredential } from "@azure/identity";

const DEFAULT_OPENAI_SCOPE = "https://cognitiveservices.azure.com/.default";
const DEFAULT_AZURE_MANAGEMENT_SCOPE = "https://management.azure.com/.default";
const KEY_VAULT_SCOPE = "https://vault.azure.net/.default";
const KEY_VAULT_API_VERSION = "7.4";

let defaultCredential: DefaultAzureCredential | undefined;

function getManagedIdentityClientId(config: AthenaConfig): string | undefined {
  return (
    config.azure?.managedIdentityClientId ??
    process.env.ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID ??
    process.env.AZURE_CLIENT_ID
  );
}

function getDefaultCredential(config: AthenaConfig): DefaultAzureCredential {
  if (!defaultCredential) {
    const managedIdentityClientId = getManagedIdentityClientId(config);
    defaultCredential = new DefaultAzureCredential(
      managedIdentityClientId ? { managedIdentityClientId } : undefined
    );
  }
  return defaultCredential;
}

async function getBearerToken(config: AthenaConfig, scope: string): Promise<string> {
  const credential = getDefaultCredential(config);
  const token = await credential.getToken(scope);
  if (!token?.token) {
    throw new AthenaError("PROVIDER_ERROR", `azure identity token acquisition returned empty token for scope ${scope}`, true);
  }
  return token.token;
}

export function createOpenAiAzureTokenProvider(config: AthenaConfig): (() => Promise<string>) | undefined {
  if (!config.azure?.enabled || !config.azure.openaiUseEntraId) {
    return undefined;
  }
  const scope = config.azure.openaiAudience ?? DEFAULT_OPENAI_SCOPE;
  return async () => getBearerToken(config, scope);
}

export function createOpenAiApiKeyResolver(config: AthenaConfig): (() => Promise<string | undefined>) | undefined {
  if (!config.azure?.enabled) {
    return undefined;
  }
  const keyVaultUrl = config.azure?.keyVaultUrl;
  const openaiApiKeySecretName = config.azure?.openaiApiKeySecretName;
  if (!keyVaultUrl || !openaiApiKeySecretName) {
    return undefined;
  }

  let cachedApiKey: string | undefined;
  let attempted = false;

  return async () => {
    if (attempted) {
      return cachedApiKey;
    }
    attempted = true;
    const token = await getBearerToken(config, KEY_VAULT_SCOPE);
    const normalizedVaultUrl = keyVaultUrl.endsWith("/") ? keyVaultUrl.slice(0, -1) : keyVaultUrl;
    const secretEndpoint = `${normalizedVaultUrl}/secrets/${encodeURIComponent(openaiApiKeySecretName)}?api-version=${KEY_VAULT_API_VERSION}`;
    const response = await fetch(secretEndpoint, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const message = await response.text();
      throw new AthenaError(
        "PROVIDER_ERROR",
        `azure key vault secret lookup failed (${response.status})${message ? `: ${message}` : ""}`,
        response.status >= 500
      );
    }

    const parsed = (await response.json()) as { value?: string };
    cachedApiKey = parsed.value?.trim() || undefined;
    return cachedApiKey;
  };
}

export function createAzureManagementTokenProvider(config: AthenaConfig): (() => Promise<string>) | undefined {
  if (!config.azure?.enabled || !config.azure.billing?.enabled) {
    return undefined;
  }
  const scope = config.azure.billing.audience ?? DEFAULT_AZURE_MANAGEMENT_SCOPE;
  return async () => getBearerToken(config, scope);
}
