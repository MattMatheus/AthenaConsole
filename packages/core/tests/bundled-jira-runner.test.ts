import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const runnerPath = resolve(repoRoot, "bundled-plugins/jira/scripts/jira-runner.mjs");

describe("bundled Jira runner", () => {
  it("reads Console task inputs and emits fixture-safe connector audit metadata", () => {
    const output = runRunner("issue-context", {
      task: {
        id: "task-jira-context",
        inputs: {
          site: "https://acme.atlassian.net",
          issueKey: "ENG-1842",
          repository: "acme/widget-service",
          focus: "Check rollout risk."
        }
      },
      inputs: {
        issueKey: "LEGACY-1"
      }
    });

    expect(output.output.content).toContain("Issue: ENG-1842");
    expect(output.output.content).toContain("Repository: acme/widget-service");
    expect(output.output.content).not.toContain("LEGACY-1");
    expect(output.artifacts[0]?.metadata).toMatchObject({
      connectorId: "jira.atlassian.com",
      operationId: "issue-read",
      liveNetwork: false,
      externalWritePublished: false
    });
    expect(output.events).toEqual([
      expect.objectContaining({
        type: "connector.issue.read",
        payload: expect.objectContaining({
          serviceId: "jira.atlassian.com",
          operationClass: "read",
          issueKey: "ENG-1842",
          siteHost: "acme.atlassian.net",
          liveNetwork: false
        })
      })
    ]);
    expect(JSON.stringify(output)).not.toContain("local-file:/");
    expect(JSON.stringify(output)).not.toContain("secret-token-value");
  });
});

function runRunner(mode: string, envelope: unknown): {
  output: { content: string };
  artifacts: Array<{ metadata?: Record<string, unknown> }>;
  events: Array<{ type: string; payload?: Record<string, unknown> }>;
} {
  const stdout = execFileSync(process.execPath, [runnerPath, mode], {
    cwd: repoRoot,
    input: JSON.stringify(envelope),
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout);
}
