import { AthenaError } from "../runtime/errors.js";
import type { RunRequest, RunResult } from "../shared/contracts.js";
import type { ProviderAdapter } from "./index.js";

const DEFAULT_FOUNDRY_API_VERSION = "2024-05-01-preview";

interface FoundryChatCompletionsResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>
        | {
            text?: string;
          };
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface FoundryProviderOptions {
  projectEndpoint: string;
  deployment: string;
  apiVersion?: string;
  apiKey?: string;
  getApiKey?: () => Promise<string | undefined>;
  getBearerToken?: () => Promise<string>;
}

export class FoundryProviderAdapter implements ProviderAdapter {
  readonly id = "foundry";

  constructor(private readonly options: FoundryProviderOptions) {}

  async generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult> {
    const endpoint = this.options.projectEndpoint.trim();
    const deployment = this.options.deployment.trim();
    if (!endpoint || !deployment) {
      throw new AthenaError(
        "PROVIDER_ERROR",
        `foundry provider is missing endpoint or deployment configuration (endpointLength=${endpoint.length}, deploymentLength=${deployment.length})`,
        true
      );
    }

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    const apiKey = this.options.apiKey ?? (await this.options.getApiKey?.());
    if (this.options.getBearerToken) {
      try {
        headers.authorization = `Bearer ${await this.options.getBearerToken()}`;
      } catch (error) {
        if (apiKey) {
          headers["api-key"] = apiKey;
        } else if (error instanceof AthenaError) {
          throw error;
        } else {
          throw new AthenaError("PROVIDER_ERROR", "foundry Entra ID authentication failed", true, error);
        }
      }
    } else if (apiKey) {
      headers["api-key"] = apiKey;
    }

    if (!headers.authorization && !headers["api-key"]) {
      throw new AthenaError("PROVIDER_ERROR", "foundry provider requires Entra ID or API key authentication", true);
    }

    try {
      const response = await fetch(buildCompletionsUrl(endpoint, deployment, this.options.apiVersion), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model ?? deployment,
          messages: [{ role: "user", content: request.input }],
          ...(typeof request.maxOutputTokens === "number" ? { max_tokens: request.maxOutputTokens } : {})
        }),
        ...(options?.signal ? { signal: options.signal } : {})
      });

      if (!response.ok) {
        const errorMessage = await parseErrorMessage(response);
        const retryable = response.status === 429 || response.status >= 500;
        throw new AthenaError(
          "PROVIDER_ERROR",
          `foundry provider error ${response.status}${errorMessage ? `: ${errorMessage}` : ""}`,
          retryable
        );
      }

      const parsed = (await response.json()) as FoundryChatCompletionsResponse;
      const output = extractOutputText(parsed.choices?.[0]?.message?.content);
      if (!output) {
        throw new AthenaError("PROVIDER_ERROR", "foundry provider returned empty output", false);
      }

      const inputTokens = parsed.usage?.prompt_tokens;
      const outputTokens = parsed.usage?.completion_tokens;
      const totalTokens =
        parsed.usage?.total_tokens ??
        (typeof inputTokens === "number" && typeof outputTokens === "number" ? inputTokens + outputTokens : undefined);

      return {
        sessionId: request.sessionId,
        output,
        model: parsed.model ?? request.model ?? deployment,
        provider: this.id,
        ...(parsed.usage
          ? {
              usage: {
                ...(typeof inputTokens === "number" ? { inputTokens } : {}),
                ...(typeof outputTokens === "number" ? { outputTokens } : {}),
                ...(typeof totalTokens === "number" ? { totalTokens } : {})
              }
            }
          : {}),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof AthenaError) {
        throw error;
      }
      throw new AthenaError("PROVIDER_ERROR", "foundry provider request failed", true, error);
    }
  }
}

function buildCompletionsUrl(projectEndpoint: string, deployment: string, apiVersion?: string): string {
  const normalizedEndpoint = projectEndpoint.endsWith("/") ? projectEndpoint : `${projectEndpoint}/`;
  const base = new URL(normalizedEndpoint);
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions`;
  base.searchParams.set("api-version", (apiVersion ?? DEFAULT_FOUNDRY_API_VERSION).trim() || DEFAULT_FOUNDRY_API_VERSION);
  return base.toString();
}

function extractOutputText(
  content:
    | string
    | Array<{
        type?: string;
        text?: string;
      }>
    | {
        text?: string;
      }
    | undefined
): string | undefined {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("");
    return text || undefined;
  }

  if (content && typeof content.text === "string") {
    return content.text;
  }

  return undefined;
}

async function parseErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const parsed = (await response.json()) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Ignore parse failures and fall back to status-only messaging.
  }
  return undefined;
}
