import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RunRequest, RunResult } from "../shared/contracts.js";
import { AthenaError } from "../runtime/errors.js";
import type { ProviderAdapter } from "./index.js";

const execFileAsync = promisify(execFile);

export interface LocalExecProviderOptions {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export class LocalExecProviderAdapter implements ProviderAdapter {
  readonly id = "local-exec";

  constructor(private readonly options: LocalExecProviderOptions) {}

  async generate(request: RunRequest, options?: { signal?: AbortSignal }): Promise<RunResult> {
    const input = request.input ?? "";
    try {
      const { stdout, stderr } = await execFileAsync(this.options.command, [...(this.options.args ?? []), input], {
        timeout: this.options.timeoutMs ?? 15_000,
        maxBuffer: 1024 * 1024,
        ...(options?.signal ? { signal: options.signal } : {})
      });

      const output = `${stdout}`.trim() || `${stderr}`.trim();
      return {
        sessionId: request.sessionId,
        output: output || "",
        model: request.model ?? "local-exec",
        provider: this.id,
        usage: {
          inputTokens: input.length,
          outputTokens: output.length,
          totalTokens: input.length + output.length
        },
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      throw new AthenaError("PROVIDER_ERROR", "local-exec provider failed", true, error);
    }
  }
}
