import { describe, expect, it } from "vitest";
import { executeModelWithRepair, type PersonaRuntimeRunResult } from "../src/personas/run.js";

function validModelOutputJson(mergeGate: "pass" | "fail" = "pass"): string {
  return JSON.stringify({
    schemaVersion: 1,
    mergeGate,
    reportMarkdown: "# ok",
    findings: [],
    dependencyInspection: { status: "ok", notes: [] }
  });
}

describe("persona model execution with repair", () => {
  it("retries once with repair prompt when initial output is invalid", async () => {
    const calls: Array<{ input: string; trigger: string }> = [];
    const runtime = {
      async run(request: {
        sessionId: string;
        input: string;
        metadata: Record<string, string>;
      }): Promise<PersonaRuntimeRunResult> {
        calls.push({ input: request.input, trigger: request.metadata.trigger ?? "" });
        if (request.metadata.trigger === "persona:run") {
          return {
            output: "not-json",
            provider: "mock",
            model: "m1",
            createdAt: new Date().toISOString()
          };
        }
        return {
          output: validModelOutputJson("pass"),
          provider: "mock",
          model: "m1",
          createdAt: new Date().toISOString()
        };
      }
    };

    const result = await executeModelWithRepair({
      runtime,
      sessionId: "session-1",
      prompt: "review prompt",
      personaName: "code-review",
      repoPath: "/repo"
    });

    expect(result.status).toBe("ok");
    expect(result.parseRetryAttempted).toBe(true);
    expect(result.parsed.parsed).toBeDefined();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.trigger).toBe("persona:run");
    expect(calls[1]?.trigger).toBe("persona:repair-json");
    expect(calls[1]?.input.toLowerCase()).toContain("previous response was invalid json");
  });

  it("returns failed status when initial runtime call throws", async () => {
    const runtime = {
      async run(): Promise<PersonaRuntimeRunResult> {
        throw new Error("provider offline");
      }
    };

    const result = await executeModelWithRepair({
      runtime,
      sessionId: "session-1",
      prompt: "review prompt",
      personaName: "code-review",
      repoPath: "/repo"
    });

    expect(result.status).toBe("failed");
    expect(result.parseRetryAttempted).toBe(false);
    expect(result.topError?.message).toBe("provider offline");
  });

  it("fails with repair error when repair call throws", async () => {
    let callCount = 0;
    const runtime = {
      async run(): Promise<PersonaRuntimeRunResult> {
        callCount += 1;
        if (callCount === 1) {
          return {
            output: "still not json",
            provider: "mock",
            model: "m1",
            createdAt: new Date().toISOString()
          };
        }
        throw new Error("repair endpoint error");
      }
    };

    const result = await executeModelWithRepair({
      runtime,
      sessionId: "session-1",
      prompt: "review prompt",
      personaName: "code-review",
      repoPath: "/repo"
    });

    expect(result.status).toBe("failed");
    expect(result.parseRetryAttempted).toBe(true);
    expect(result.topError?.message).toBe("Repair retry failed: repair endpoint error");
    expect(result.parsed.error).toBe("Repair retry failed: repair endpoint error");
  });
});
