import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ProviderRegistry, type ProviderAdapter } from "../src/providers/index.js";
import { createRuntime } from "../src/runtime/index.js";
import type { RunRequest, RunResult } from "../src/shared/contracts.js";

class SlowProvider implements ProviderAdapter {
  readonly id = "slow";

  async generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 120);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      };
      if (options?.signal) {
        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    });

    return {
      sessionId: request.sessionId,
      output: "slow-ok",
      model: "slow-model",
      provider: this.id,
      createdAt: new Date().toISOString()
    };
  }
}

function config(workspaceRoot: string) {
  return {
    workspaceRoot,
    stateDir: ".athena",
    defaultProvider: "slow",
    defaultModel: "slow-model",
    providerFallbackOrder: [],
    localProviderCommand: "/bin/echo",
    localProviderArgs: [],
    httpProviderUrl: undefined,
    httpProviderApiKey: undefined,
    httpProviderTimeoutMs: 20000,
    runtimeRunTimeoutMs: 50,
    scheduleRunTimeoutMs: 45000
  };
}

describe("runtime timeout", () => {
  it("fails with RUN_TIMEOUT and allows subsequent runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-runtime-timeout-"));
    try {
      const providers = new ProviderRegistry();
      providers.register(new SlowProvider());
      const runtime = createRuntime({
        config: config(dir),
        providers,
        maxAttempts: 1
      });

      await expect(runtime.run({ sessionId: "s1", input: "hello" })).rejects.toMatchObject({
        code: "RUN_TIMEOUT"
      });

      const retry = await runtime.run({ sessionId: "s1", input: "hello again" }, { timeoutMs: 300 });
      expect(retry.output).toBe("slow-ok");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
