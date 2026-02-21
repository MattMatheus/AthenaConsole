import { describe, expect, it } from "vitest";
import {
  MockFileStateStore,
  MockGitService,
  MockRuntime,
  PersonaTestHarness,
  type PersonaDefinition
} from "@athena/pdk";

function createPersona(): PersonaDefinition {
  return {
    schemaVersion: 1,
    id: "code-review",
    context: {
      promptFiles: ["prompt.md"],
      skillFiles: ["skills.md"],
      docFiles: ["docs.md"]
    },
    review: {
      rubric: {
        security: true
      }
    }
  };
}

describe("pdk PersonaTestHarness", () => {
  it("assembles context files, builds final prompt, and parses mapped output", async () => {
    const runtime = new MockRuntime({
      resolveResponse: (request) => {
        if (request.metadata.trigger !== "persona:run") {
          return undefined;
        }
        return JSON.stringify({
          schemaVersion: 1,
          mergeGate: "pass",
          reportMarkdown: "# ok",
          findings: [],
          dependencyInspection: {
            status: "ok",
            notes: ["checked"]
          }
        });
      }
    });

    const harness = new PersonaTestHarness({
      persona: createPersona(),
      runtime,
      fileStateStore: new MockFileStateStore({
        files: {
          "prompt.md": "System prompt",
          "skills.md": "Skill list",
          "docs.md": "Doc content"
        }
      }),
      gitService: new MockGitService({
        changedFiles: ["src/a.ts"],
        diff: "diff --git a/src/a.ts b/src/a.ts"
      }),
      repoPath: "/repo",
      baseRef: "main",
      headRef: "feature"
    });

    const result = await harness.run();

    expect(result.contextPack.includedFiles).toEqual(["prompt.md", "skills.md", "docs.md"]);
    expect(result.prompt).toContain("Curated persona context manifest summary:");
    expect(result.prompt).toContain("Compare: main..feature");
    expect(result.prompt).toContain("Changed files (bounded):\nsrc/a.ts");
    expect(result.prompt).toContain("System prompt");
    expect(result.prompt).toContain("Doc content");
    expect(result.runtimeCalls).toHaveLength(1);
    expect(result.runtimeCalls[0]?.input).toBe(result.prompt);
    expect(result.parsedOutput.parsed).toBe(true);
    expect(result.parsedOutput.parseRetryAttempted).toBe(false);
    expect(result.parsedOutput.mergeGate).toBe("pass");
    expect(result.runOutput.status).toBe("ok");
    expect(result.runOutput.modelOutputParsed).toBe(true);
  });

  it("retries with repair prompt and parses repaired output", async () => {
    const runtime = new MockRuntime({
      resolveResponse: (request) => {
        if (request.metadata.trigger === "persona:run") {
          return "not-json";
        }
        if (request.metadata.trigger === "persona:repair-json") {
          return JSON.stringify({
            schemaVersion: 1,
            mergeGate: "fail",
            reportMarkdown: "# repaired",
            findings: [
              {
                priority: "P1",
                confidence: 0.9,
                title: "critical",
                message: "must fail merge gate"
              }
            ],
            dependencyInspection: {
              status: "skipped",
              notes: ["repair"]
            }
          });
        }
        return undefined;
      }
    });

    const harness = new PersonaTestHarness({
      persona: createPersona(),
      runtime,
      fileStateStore: new MockFileStateStore({
        files: {
          "prompt.md": "System prompt",
          "skills.md": "Skill list",
          "docs.md": "Doc content"
        }
      }),
      gitService: new MockGitService()
    });

    const result = await harness.run();

    expect(result.runtimeCalls).toHaveLength(2);
    expect(result.runtimeCalls[0]?.metadata.trigger).toBe("persona:run");
    expect(result.runtimeCalls[1]?.metadata.trigger).toBe("persona:repair-json");
    expect(result.runtimeCalls[1]?.input.toLowerCase()).toContain("previous response was invalid json");
    expect(result.parsedOutput.parsed).toBe(true);
    expect(result.parsedOutput.parseRetryAttempted).toBe(true);
    expect(result.parsedOutput.mergeGate).toBe("fail");
    expect(result.parsedOutput.findings[0]?.priority).toBe("P1");
    expect(result.runOutput.status).toBe("ok");
    expect(result.runOutput.parseRetryAttempted).toBe(true);
  });
});
