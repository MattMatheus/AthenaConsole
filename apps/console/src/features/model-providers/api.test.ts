import { describe, expect, it } from "vitest";
import { parseModelProvider } from "./api";

describe("model provider api model", () => {
  it("parses valid provider metadata", () => {
    expect(
      parseModelProvider({
        id: "openai-main",
        name: "OpenAI Main",
        providerKind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4.1-mini",
        secret: {
          kind: "env",
          name: "OPENAI_API_KEY",
          configured: true,
        },
        status: "configured",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "openai-main",
      providerKind: "openai-compatible",
      secret: {
        kind: "env",
        name: "OPENAI_API_KEY",
        configured: true,
      },
      status: "configured",
    });
  });

  it("rejects provider payloads with unsupported contract values", () => {
    const basePayload = {
      id: "provider",
      name: "Provider",
      providerKind: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4.1-mini",
      secret: {
        kind: "env",
        name: "OPENAI_API_KEY",
        configured: true,
      },
      status: "configured",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => parseModelProvider({ ...basePayload, providerKind: "unknown-provider" })).toThrow(
      "Model provider kind is invalid.",
    );
    expect(() =>
      parseModelProvider({
        ...basePayload,
        secret: {
          ...basePayload.secret,
          kind: "inline",
        },
      }),
    ).toThrow("Model provider secret kind is invalid.");
  });
});
