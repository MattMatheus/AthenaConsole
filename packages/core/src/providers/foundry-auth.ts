import { DefaultAzureCredential } from "@azure/identity";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";

const DEFAULT_FOUNDRY_AUDIENCE = "https://cognitiveservices.azure.com/.default";
const TOKEN_REFRESH_WINDOW_MS = 60_000;

interface TokenCacheEntry {
  token: string;
  expiresOnTimestamp?: number;
}

let defaultCredential: DefaultAzureCredential | undefined;

function getDefaultCredential(config: AthenaConfig): DefaultAzureCredential {
  if (!defaultCredential) {
    const managedIdentityClientId =
      config.foundry?.managedIdentityClientId ??
      config.azure?.managedIdentityClientId ??
      process.env.ATHENA_FOUNDRY_MANAGED_IDENTITY_CLIENT_ID ??
      process.env.ATHENA_AZURE_MANAGED_IDENTITY_CLIENT_ID ??
      process.env.AZURE_CLIENT_ID;
    defaultCredential = new DefaultAzureCredential(
      managedIdentityClientId ? { managedIdentityClientId } : undefined
    );
  }
  return defaultCredential;
}

export function createFoundryTokenProvider(config: AthenaConfig): (() => Promise<string>) | undefined {
  if (!config.foundry?.enabled || !config.foundry.useEntraId) {
    return undefined;
  }

  const audience = config.foundry.audience || DEFAULT_FOUNDRY_AUDIENCE;
  let cache: TokenCacheEntry | undefined;

  return async () => {
    if (
      cache?.token &&
      (!cache.expiresOnTimestamp || cache.expiresOnTimestamp - TOKEN_REFRESH_WINDOW_MS > Date.now())
    ) {
      return cache.token;
    }

    try {
      const token = await getDefaultCredential(config).getToken(audience);
      const resolved = token?.token?.trim();
      if (!resolved) {
        throw new AthenaError(
          "PROVIDER_ERROR",
          `foundry token acquisition returned an empty token for audience ${audience}`,
          true
        );
      }
      cache = {
        token: resolved,
        ...(typeof token.expiresOnTimestamp === "number"
          ? { expiresOnTimestamp: token.expiresOnTimestamp }
          : {})
      };
      return resolved;
    } catch (error) {
      if (error instanceof AthenaError) {
        throw error;
      }
      throw new AthenaError("PROVIDER_ERROR", "foundry token acquisition failed", true, error);
    }
  };
}
