import { AthenaError } from "../runtime/errors.js";
import type { RunRequest, RunResult } from "../shared/contracts.js";
import type { ProviderAdapter } from "./index.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

interface OpenAIChatCompletionsResponse {
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

export interface OpenAIProviderOptions {
  apiKey?: string;
  baseURL?: string;
  getApiKey?: () => Promise<string | undefined>;
  getBearerToken?: () => Promise<string>;
}

export class OpenAIProviderAdapter implements ProviderAdapter {
  readonly id = "openai";

  constructor(private readonly options: OpenAIProviderOptions = {}) {}

  async generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult> {
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json"
      };
      const resolvedApiKey = this.options.apiKey ?? (await this.options.getApiKey?.());
      if (resolvedApiKey) {
        headers.authorization = `Bearer ${resolvedApiKey}`;
      } else if (this.options.getBearerToken) {
        headers.authorization = `Bearer ${await this.options.getBearerToken()}`;
      }

      const response = await fetch(buildCompletionsUrl(this.options.baseURL), {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model ?? "gpt-4o-mini",
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
          `openai provider error ${response.status}${errorMessage ? `: ${errorMessage}` : ""}`,
          retryable
        );
      }

      const parsed = (await response.json()) as OpenAIChatCompletionsResponse;
      const output = extractOutputText(parsed.choices?.[0]?.message?.content);
      if (!output) {
        throw new AthenaError("PROVIDER_ERROR", "openai provider returned empty output", false);
      }

      const inputTokens = parsed.usage?.prompt_tokens;
      const outputTokens = parsed.usage?.completion_tokens;
      const totalTokens =
        parsed.usage?.total_tokens ??
        (typeof inputTokens === "number" && typeof outputTokens === "number" ? inputTokens + outputTokens : undefined);

      return {
        sessionId: request.sessionId,
        output,
        model: parsed.model ?? request.model ?? "openai-model",
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
      throw new AthenaError("PROVIDER_ERROR", "openai provider request failed", true, error);
    }
  }
}

function buildCompletionsUrl(baseURL: string | undefined): string {
  const normalizedBaseUrl = (baseURL ?? DEFAULT_OPENAI_BASE_URL).trim();
  const baseWithSlash = normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`;
  return new URL("chat/completions", baseWithSlash).toString();
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
