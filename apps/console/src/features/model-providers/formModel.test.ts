import { describe, expect, it } from "vitest";
import {
  buildProviderCreateRequest,
  draftFromProvider,
  modelProviderStatusTone,
  secretReferenceLabel,
} from "./formModel";
import type { ModelProviderConfig } from "./types";

describe("model provider form model", () => {
  it("builds provider config requests with secret references only", () => {
    expect(
      buildProviderCreateRequest({
        id: " openai-main ",
        name: " OpenAI Main ",
        baseUrl: " https://api.openai.com/v1 ",
        defaultModel: " gpt-4.1-mini ",
        secretKind: "env",
        secretName: " OPENAI_API_KEY ",
      }),
    ).toEqual({
      request: {
        id: "openai-main",
        name: "OpenAI Main",
        providerKind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4.1-mini",
        secret: {
          kind: "env",
          name: "OPENAI_API_KEY",
        },
      },
      errors: {},
    });
  });

  it("validates local-file references and labels redacted references", () => {
    expect(
      buildProviderCreateRequest({
        id: "",
        name: "Local key",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4.1-mini",
        secretKind: "local-file",
        secretName: "relative/key.txt",
      }).errors.secretName,
    ).toBe("Local-file secret references must use an absolute path.");
    expect(secretReferenceLabel("local-file", "/run/secrets/openai")).toBe("file:/run/secrets/openai");
  });

  it("hydrates edit drafts from redacted provider metadata", () => {
    expect(draftFromProvider(provider()).secretName).toBe("OPENAI_API_KEY");
    expect(modelProviderStatusTone("configured")).toBe("ready");
    expect(modelProviderStatusTone("missing")).toBe("degraded");
    expect(modelProviderStatusTone("invalid")).toBe("failed");
  });
});

function provider(): ModelProviderConfig {
  return {
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
  };
}
