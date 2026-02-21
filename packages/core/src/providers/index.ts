import type { RunRequest, RunResult } from "../shared/contracts.js";
import type { AthenaConfig } from "../shared/config.js";
import { createOpenAiApiKeyResolver, createOpenAiAzureTokenProvider } from "./azure-auth.js";
import { HttpProviderAdapter } from "./http.js";
import { LocalExecProviderAdapter } from "./local-exec.js";
import { MockProviderAdapter } from "./mock.js";
import { OpenAIProviderAdapter } from "./openai.js";

export interface ProviderAdapter {
  id: string;
  generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult>;
}

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }
}

export function createDefaultProviderRegistry(config: AthenaConfig): ProviderRegistry {
  const registry = new ProviderRegistry();
  const openAiApiKeyResolver = createOpenAiApiKeyResolver(config);
  const openAiBearerTokenProvider = createOpenAiAzureTokenProvider(config);
  registry.register(new MockProviderAdapter());
  registry.register(
    new OpenAIProviderAdapter({
      ...(config.openaiApiKey ? { apiKey: config.openaiApiKey } : {}),
      ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
      ...(openAiApiKeyResolver ? { getApiKey: openAiApiKeyResolver } : {}),
      ...(openAiBearerTokenProvider ? { getBearerToken: openAiBearerTokenProvider } : {})
    })
  );
  registry.register(
    new LocalExecProviderAdapter({
      command: config.localProviderCommand,
      args: config.localProviderArgs
    })
  );
  if (config.httpProviderUrl) {
    registry.register(
      new HttpProviderAdapter({
        url: config.httpProviderUrl,
        apiKey: config.httpProviderApiKey,
        timeoutMs: config.httpProviderTimeoutMs
      })
    );
  }
  return registry;
}
