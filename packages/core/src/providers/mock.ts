import type { ProviderAdapter } from "./index.js";
import type { RunRequest, RunResult } from "../shared/contracts.js";

export class MockProviderAdapter implements ProviderAdapter {
  readonly id = "mock";

  async generate(request: RunRequest, _options?: { signal?: AbortSignal }): Promise<RunResult> {
    const input = request.input ?? "";
    const now = new Date().toISOString();
    const output = request.metadata?.trigger === "agent:run"
      ? JSON.stringify(
          {
            schemaVersion: 1,
            mergeGate: "pass",
            reportMarkdown: "Mock report content...",
            findings: [],
            dependencyInspection: {
              status: "ok",
              notes: []
            }
          },
          null,
          2
        )
      : `Echo: ${input}`;

    return {
      sessionId: request.sessionId,
      output,
      model: request.model ?? "mock-model",
      provider: this.id,
      usage: {
        inputTokens: input.length,
        outputTokens: output.length,
        totalTokens: input.length + output.length
      },
      createdAt: now
    };
  }
}
