import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRegistry, type ProviderAdapter } from "../src/providers/index.js";
import { AthenaError } from "../src/runtime/errors.js";
import { createRuntime } from "../src/runtime/index.js";
import type { RunRequest, RunResult } from "../src/shared/contracts.js";

class FailingProvider implements ProviderAdapter {
  constructor(public readonly id: string) {}

  async generate(_request: RunRequest, _options?: { signal?: AbortSignal }): Promise<RunResult> {
    throw new AthenaError("PROVIDER_ERROR", "simulated failure", true);
  }
}

class SuccessProvider implements ProviderAdapter {
  constructor(public readonly id: string) {}

  async generate(request: RunRequest, _options?: { signal?: AbortSignal }): Promise<RunResult> {
    return {
      sessionId: request.sessionId,
      output: "ok-from-fallback",
      model: "backup-model",
      provider: this.id,
      createdAt: new Date().toISOString()
    };
  }
}

function testConfig(workspaceRoot: string) {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "broken",
    defaultModel: "m1",
    providerFallbackOrder: ["backup"],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 30000,
    scheduleRunTimeoutMs: 45000
  };
}

describe.sequential("runtime provider fallback", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("falls back to next provider on retryable failure and persists final model/provider", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-fallback-"));
    const sessionId = `s-${randomUUID()}`;

    try {
      const providers = new ProviderRegistry();
      providers.register(new FailingProvider("broken"));
      providers.register(new SuccessProvider("backup"));

      const runtime = createRuntime({
        config: testConfig(dir),
        providers,
        maxAttempts: 1
      });

      const result = await runtime.run({ sessionId, input: "test" });
      expect(result.provider).toBe("backup");
      expect(result.model).toBe("backup-model");
      expect(result.output).toBe("ok-from-fallback");
      expect(result.reliability).toMatchObject({
        providerAttempts: 2,
        providerRetries: 0,
        fallbackHops: 1
      });

      const sessionPath = join(dir, ".athena", "sessions", `${sessionId}.json`);
      const sessionRecord = JSON.parse(readFileSync(sessionPath, "utf8")) as { provider: string; model: string };
      expect(sessionRecord.provider).toBe("backup");
      expect(sessionRecord.model).toBe("backup-model");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns PROVIDER_ERROR when at least one provider is registered but all fail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-fallback-classification-"));
    const sessionId = `s-${randomUUID()}`;

    try {
      const providers = new ProviderRegistry();
      providers.register(new FailingProvider("broken"));

      const runtime = createRuntime({
        config: {
          ...testConfig(dir),
          providerFallbackOrder: ["missing"]
        },
        providers,
        maxAttempts: 1
      });

      await expect(runtime.run({ sessionId, input: "test" })).rejects.toMatchObject({
        code: "PROVIDER_ERROR"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
