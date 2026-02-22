import { afterEach, describe, expect, it, vi } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import { FoundryProviderAdapter } from "../src/providers/foundry.js";

describe("foundry provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("constructs Foundry inference endpoint and maps success response", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "Hello from foundry" } }],
          usage: { prompt_tokens: 9, completion_tokens: 5, total_tokens: 14 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-4o-mini",
      apiVersion: "2024-05-01-preview",
      apiKey: "foundry-key"
    });

    const result = await provider.generate({
      sessionId: "session-1",
      input: "say hello",
      maxOutputTokens: 128
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://athena-foundry.services.ai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-05-01-preview"
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "api-key": "foundry-key"
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "say hello" }],
      max_tokens: 128
    });
    expect(result).toMatchObject({
      sessionId: "session-1",
      output: "Hello from foundry",
      model: "gpt-4o-mini",
      provider: "foundry",
      usage: {
        inputTokens: 9,
        outputTokens: 5,
        totalTokens: 14
      }
    });
  });

  it("prefers Entra token auth and falls back to API key when token acquisition fails", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Fallback auth mode" } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-4o-mini",
      apiKey: "fallback-key",
      getBearerToken: async () => {
        throw new Error("no token");
      }
    });

    await provider.generate({ sessionId: "session-1", input: "hello" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      "api-key": "fallback-key"
    });
  });

  it("marks 429 responses as retryable errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "rate limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-4o-mini",
      apiKey: "foundry-key"
    });

    await expect(provider.generate({ sessionId: "session-1", input: "hello" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      retryable: true
    });
  });

  it("throws non-retryable error when response has no assistant text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }))
    );

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-4o-mini",
      apiKey: "foundry-key"
    });

    await expect(provider.generate({ sessionId: "session-1", input: "hello" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      retryable: false
    });
  });

  it("uses responses API for gpt-5/codex models", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-5.1-codex-mini",
          output_text: "Implementation output",
          usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-5.1-codex-mini",
      apiKey: "foundry-key"
    });

    const result = await provider.generate({
      sessionId: "session-1",
      input: "implement",
      model: "gpt-5.1-codex-mini"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://athena-foundry.services.ai.azure.com/openai/v1/responses");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-5.1-codex-mini",
      input: "implement"
    });
    expect(result.output).toBe("Implementation output");
    expect(result.usage?.totalTokens).toBe(18);
  });

  it("falls back to responses API when chat completions is unsupported", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message:
                "The chatCompletion operation does not work with the specified model"
            }
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text: "fallback output",
            usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "custom-model",
      apiKey: "foundry-key"
    });

    const result = await provider.generate({
      sessionId: "session-1",
      input: "test fallback",
      model: "custom-model"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain("/chat/completions");
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("https://athena-foundry.services.ai.azure.com/openai/v1/responses");
    expect(result.output).toBe("fallback output");
  });

  it("throws retryable provider error when auth is not configured", async () => {
    const provider = new FoundryProviderAdapter({
      projectEndpoint: "https://athena-foundry.services.ai.azure.com",
      deployment: "gpt-4o-mini"
    });

    try {
      await provider.generate({ sessionId: "session-1", input: "hello" });
      throw new Error("expected provider to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AthenaError);
      expect((error as AthenaError).retryable).toBe(true);
    }
  });
});
