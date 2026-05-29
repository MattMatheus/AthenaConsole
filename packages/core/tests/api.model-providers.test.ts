import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

describe("model provider api", () => {
  it("creates, lists, tests, updates, and deletes redacted provider configs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-model-provider-"));
    const secretFile = join(dir, "openai.key");
    writeFileSync(secretFile, "sk-api-secret\n", "utf8");
    const server = createApiServer({
      config: loadConfig(dir),
      host: "127.0.0.1",
      port: 0
    });
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const createResponse = await fetch(`${base}/api/v1/model-providers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "provider-openai",
          name: "OpenAI",
          providerKind: "openai-compatible",
          defaultModel: "gpt-4.1-mini",
          secret: {
            kind: "local-file",
            name: secretFile
          }
        })
      });
      expect(createResponse.status).toBe(200);
      const createEnvelope = (await createResponse.json()) as {
        data: { id: string; status: string; secret: { configured: boolean } };
      };
      expect(createEnvelope.data).toMatchObject({
        id: "provider-openai",
        status: "configured",
        secret: { configured: true }
      });
      expect(JSON.stringify(createEnvelope)).not.toContain("sk-api-secret");

      const listResponse = await fetch(`${base}/api/v1/model-providers`);
      expect(listResponse.status).toBe(200);
      const listEnvelope = (await listResponse.json()) as { data: { total: number; providers: Array<{ id: string }> } };
      expect(listEnvelope.data).toMatchObject({
        total: 1,
        providers: [{ id: "provider-openai" }]
      });

      const testResponse = await fetch(`${base}/api/v1/model-providers/${encodeURIComponent("provider-openai")}/test`, {
        method: "POST"
      });
      expect(testResponse.status).toBe(200);
      const testEnvelope = (await testResponse.json()) as { data: { status: string; message: string } };
      expect(testEnvelope.data.status).toBe("configured");
      expect(testEnvelope.data.message).toContain("secret reference is configured");

      const updateResponse = await fetch(`${base}/api/v1/model-providers/${encodeURIComponent("provider-openai")}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          defaultModel: "gpt-4.1",
          secret: {
            kind: "env",
            name: "ATHENA_TEST_MISSING_OPENAI_KEY"
          }
        })
      });
      expect(updateResponse.status).toBe(200);
      const updateEnvelope = (await updateResponse.json()) as { data: { defaultModel: string; status: string } };
      expect(updateEnvelope.data).toMatchObject({
        defaultModel: "gpt-4.1",
        status: "missing"
      });

      const deleteResponse = await fetch(`${base}/api/v1/model-providers/${encodeURIComponent("provider-openai")}`, {
        method: "DELETE"
      });
      expect(deleteResponse.status).toBe(200);
      const deleteEnvelope = (await deleteResponse.json()) as { data: { id: string; deleted: boolean } };
      expect(deleteEnvelope.data).toEqual({ id: "provider-openai", deleted: true });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
