import { afterEach, describe, expect, it, vi } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import { OpenAIProviderAdapter } from "../src/providers/openai.js";

describe("openai provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps successful chat completion payloads to RunResult", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "Hello from model" } }],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProviderAdapter({
      apiKey: "test-key",
      baseURL: "https://example.test/v1"
    });
    const abortController = new AbortController();
    const result = await provider.generate(
      {
        sessionId: "session-1",
        input: "say hello",
        model: "gpt-4o-mini",
        maxOutputTokens: 64
      },
      { signal: abortController.signal }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(abortController.signal);
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer test-key"
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "say hello" }],
      max_tokens: 64
    });

    expect(result).toMatchObject({
      sessionId: "session-1",
      output: "Hello from model",
      model: "gpt-4o-mini",
      provider: "openai",
      usage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18
      }
    });
  });

  it("combines text chunks when response content is an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [
              {
                message: {
                  content: [
                    { type: "text", text: "Chunk 1 " },
                    { type: "text", text: "Chunk 2" }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      })
    );

    const provider = new OpenAIProviderAdapter();
    const result = await provider.generate({
      sessionId: "session-1",
      input: "combine chunks"
    });

    expect(result.output).toBe("Chunk 1 Chunk 2");
  });

  it("classifies 401 responses as non-retryable provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "invalid api key" } }), {
          status: 401,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const provider = new OpenAIProviderAdapter();

    try {
      await provider.generate({ sessionId: "session-1", input: "hello" });
      throw new Error("expected provider to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AthenaError);
      const athenaError = error as AthenaError;
      expect(athenaError.code).toBe("PROVIDER_ERROR");
      expect(athenaError.retryable).toBe(false);
      expect(athenaError.message).toContain("401");
    }
  });

  it("classifies 429 responses as retryable provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: { message: "rate limit" } }), {
          status: 429,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const provider = new OpenAIProviderAdapter();

    await expect(provider.generate({ sessionId: "session-1", input: "hello" })).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      retryable: true
    });
  });

  it("uses async api key resolver when static key is not configured", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "Resolved key path" } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProviderAdapter({
      baseURL: "https://example.test/v1",
      getApiKey: async () => "resolved-secret"
    });

    await provider.generate({ sessionId: "session-1", input: "hello" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      authorization: "Bearer resolved-secret"
    });
  });

  it("uses bearer token provider when no API key is configured", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "Token path" } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProviderAdapter({
      baseURL: "https://example.test/v1",
      getBearerToken: async () => "entra-access-token"
    });

    await provider.generate({ sessionId: "session-1", input: "hello" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      authorization: "Bearer entra-access-token"
    });
  });
});
