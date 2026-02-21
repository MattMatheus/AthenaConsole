import type { RunRequest, RunResult } from "../shared/contracts.js";
import { AthenaError } from "../runtime/errors.js";
import type { ProviderAdapter } from "./index.js";

export interface HttpProviderOptions {
  url: string;
  apiKey: string | undefined;
  timeoutMs?: number;
}

export class HttpProviderAdapter implements ProviderAdapter {
  readonly id = "http";

  constructor(private readonly options: HttpProviderOptions) {}

  async generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult> {
    const timeoutMs = this.options.timeoutMs ?? 20_000;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener("abort", onAbort);
      }
    }
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.options.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {})
        },
        body: JSON.stringify({
          sessionId: request.sessionId,
          input: request.input,
          model: request.model,
          maxOutputTokens: request.maxOutputTokens,
          metadata: request.metadata
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw new AthenaError("PROVIDER_ERROR", `http provider error ${response.status}`, retryable);
      }

      const parsed = (await response.json()) as Partial<RunResult> & { output?: string };
      if (!parsed.output) {
        throw new AthenaError("PROVIDER_ERROR", "http provider returned empty output", false);
      }

      return {
        sessionId: request.sessionId,
        output: parsed.output,
        model: parsed.model ?? request.model ?? "http-model",
        provider: this.id,
        ...(parsed.usage ? { usage: parsed.usage } : {}),
        createdAt: parsed.createdAt ?? new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof AthenaError) {
        throw error;
      }
      throw new AthenaError("PROVIDER_ERROR", "http provider request failed", true, error);
    } finally {
      clearTimeout(timeout);
      if (options?.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
    }
  }
}
