import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const runnerPath = resolve(repoRoot, "bundled-plugins/github/scripts/github-runner.mjs");

describe("bundled GitHub runner", () => {
  it("reads Console task inputs from envelope.task.inputs", () => {
    const output = runRunner("repo-context", {
      task: {
        id: "task-github-context",
        inputs: {
          repository: "acme/canonical",
          focus: "Use canonical task input focus."
        }
      },
      inputs: {
        repository: "acme/legacy",
        focus: "This legacy focus must not be used."
      }
    });

    expect(output.output.content).toContain("Repository: acme/canonical");
    expect(output.output.content).toContain("Use canonical task input focus.");
    expect(output.output.content).not.toContain("acme/legacy");
    expect(output.output.content).not.toContain("This legacy focus must not be used.");
    expect(output.artifacts[0]?.metadata).toMatchObject({
      repository: "acme/canonical",
      liveNetwork: false,
      externalWritePublished: false
    });
  });

  it("keeps a legacy top-level inputs fallback for direct ad hoc invocations", () => {
    const output = runRunner("release-notes-draft", {
      inputs: {
        repository: "octo-org/widget",
        releaseName: "v1.2.3"
      }
    });

    expect(output.output.content).toContain("Repository: octo-org/widget");
    expect(output.output.content).toContain("Release: v1.2.3");
  });
});

function runRunner(mode: string, envelope: unknown): {
  output: { content: string };
  artifacts: Array<{ metadata?: Record<string, unknown> }>;
} {
  const stdout = execFileSync(process.execPath, [runnerPath, mode], {
    cwd: repoRoot,
    input: JSON.stringify(envelope),
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout);
}
