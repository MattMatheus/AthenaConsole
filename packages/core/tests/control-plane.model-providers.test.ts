import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalModelProviderConfigService } from "../src/control-plane/services/model-providers.js";
import { loadConfig } from "../src/shared/config.js";

describe("model provider config service", () => {
  it("redacts secret values while resolving runtime config internally", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-model-provider-service-"));
    const secretFile = join(dir, "openai.key");
    writeFileSync(secretFile, "sk-test-secret\n", "utf8");
    try {
      const service = new LocalModelProviderConfigService(loadConfig(dir));
      const provider = await service.create({
        id: "provider-openai",
        name: "OpenAI",
        providerKind: "openai-compatible",
        defaultModel: "gpt-4.1-mini",
        secret: {
          kind: "local-file",
          name: secretFile
        }
      });

      expect(provider).toMatchObject({
        id: "provider-openai",
        baseUrl: "https://api.openai.com/v1",
        status: "configured",
        secret: {
          kind: "local-file",
          name: secretFile,
          configured: true
        }
      });
      expect(JSON.stringify(provider)).not.toContain("sk-test-secret");

      const runtime = await service.resolveRuntimeConfig("provider-openai");
      expect(runtime).toEqual({
        id: "provider-openai",
        providerKind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4.1-mini",
        apiKey: "sk-test-secret"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports missing and invalid secrets without exposing raw values", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-model-provider-missing-"));
    try {
      const service = new LocalModelProviderConfigService(loadConfig(dir));
      const provider = await service.create({
        id: "provider-missing",
        name: "Missing Env",
        providerKind: "openai-compatible",
        defaultModel: "gpt-4.1-mini",
        secret: {
          kind: "env",
          name: "ATHENA_TEST_MISSING_OPENAI_KEY"
        }
      });

      expect(provider).toMatchObject({
        status: "missing",
        secret: {
          kind: "env",
          name: "ATHENA_TEST_MISSING_OPENAI_KEY",
          configured: false
        }
      });
      await expect(service.resolveRuntimeConfig("provider-missing")).rejects.toThrow(
        "Environment secret is not configured: ATHENA_TEST_MISSING_OPENAI_KEY"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
