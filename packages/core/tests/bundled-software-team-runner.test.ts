import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const runnerPath = resolve(repoRoot, "bundled-plugins/software-team/scripts/software-team-runner.mjs");

describe("bundled software-team runner", () => {
  it("reads Console task inputs from envelope.task.inputs", () => {
    const output = runRunner("repo-summary", {
      task: {
        id: "task-software-team-inputs",
        inputs: {
          repositoryPath: "/workspace/canonical-repo",
          objective: "Use the canonical task input objective.",
          memoryContext: "Use the canonical task memory context."
        }
      },
      agent: { id: "software-team.repo-summary" },
      run: { id: "run-software-team-inputs" },
      inputs: {
        repositoryPath: "/workspace/legacy-top-level-repo",
        objective: "This legacy objective must not be used."
      }
    });

    expect(output.summary).toContain("/workspace/canonical-repo");
    expect(output.summary).not.toContain("/workspace/legacy-top-level-repo");
    expect(output.output.markdown).toContain("Use the canonical task input objective.");
    expect(output.output.markdown).toContain("Operator-supplied memory context was included");
    expect(output.output.markdown).not.toContain("This legacy objective must not be used.");
  });

  it("keeps a legacy top-level inputs fallback for direct ad hoc invocations", () => {
    const output = runRunner("release-readiness", {
      inputs: {
        releaseName: "v1.2.3",
        scope: "Fallback scope"
      }
    });

    expect(output.summary).toContain("v1.2.3");
    expect(output.output.markdown).toContain("Fallback scope");
  });
});

function runRunner(mode: string, envelope: unknown): {
  summary: string;
  output: { markdown: string };
} {
  const stdout = execFileSync(process.execPath, [runnerPath, mode], {
    cwd: repoRoot,
    input: JSON.stringify(envelope),
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout);
}
