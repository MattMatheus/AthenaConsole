import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { indexLocalPluginPackage } from "../src/control-plane/plugins/index.js";
import { LocalAgentCatalogService } from "../src/control-plane/services/agent-catalog.js";
import { LocalTaskWorkbenchService } from "../src/control-plane/services/task-workbench.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const packRoot = resolve(repoRoot, "bundled-plugins/software-team");

describe("AthenaAgent repo summary bundled capability", () => {
  it("indexes, creates a task, and runs through the strict console runner bridge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-repo-summary-"));
    const previousRunner = process.env.ATHENA_AGENT_CONSOLE_RUNNER;
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      const targetRepo = join(dir, "target-repo");
      const secretFile = join(dir, "provider-key.txt");
      const fakeRunner = join(dir, "fake-athena-agent-runner.mjs");
      const fakeFailureRunner = join(dir, "fake-athena-agent-failure-runner.mjs");
      mkdirSync(join(targetRepo, "src"), { recursive: true });
      writeFileSync(join(targetRepo, "README.md"), "# Target Repo\n\nA small repository for AthenaAgent smoke testing.\n", "utf8");
      writeFileSync(join(targetRepo, "src", "index.ts"), "export const value = 1;\n", "utf8");
      writeFileSync(secretFile, "sk-athena-agent-fixture", "utf8");
      writeFileSync(
        fakeRunner,
        `
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  const repoPath = envelope.task.inputs.repo.workspacePath;
  const secret = envelope.modelProvider.apiKey;
  const slug = envelope.agent.id.replace("athena-agent.", "");
  const runId = envelope.run.id;
  process.stderr.write("debug provider key " + secret + "\\n");
  process.stdout.write(JSON.stringify({
    output: {
      markdown: "# AthenaAgent " + slug + "\\n\\nRepository: " + repoPath + "\\n\\nSecret: " + secret,
      model: envelope.modelProvider.defaultModel
    },
    artifacts: [
      {
        id: "artifact-" + runId + "-" + slug,
        label: "AthenaAgent " + slug,
        kind: "primary",
        format: "markdown",
        storageUri: "memory://athena-agent/" + runId + "/" + slug + ".md",
        metadata: {
          contentKey: "markdown",
          repositoryPath: repoPath,
          agentId: envelope.agent.id,
          capability: slug,
          leakedSecret: secret
        }
      }
    ]
  }));
});
`,
        "utf8"
      );
      writeFileSync(
        fakeFailureRunner,
        `
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  process.stderr.write("provider failed with key " + envelope.modelProvider.apiKey);
  process.exit(9);
});
`,
        "utf8"
      );
      process.env.ATHENA_AGENT_CONSOLE_RUNNER = JSON.stringify([process.execPath, fakeRunner]);

      try {
        const indexResult = indexLocalPluginPackage(appState, packRoot, "system");
        expect(indexResult.status).toBe("loaded");
        expect(indexResult.agents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "athena-agent.repo-summary",
              capabilities: expect.arrayContaining(["repo.summary", "repo.inspect", "artifacts.produce"])
            }),
            expect.objectContaining({
              id: "athena-agent.pr-diff-review",
              capabilities: expect.arrayContaining(["code.review", "diff.review", "repo.inspect", "artifacts.produce"])
            }),
            expect.objectContaining({
              id: "athena-agent.test-failure-triage",
              capabilities: expect.arrayContaining(["test.failure.triage", "test.failure.explain", "repo.inspect", "artifacts.produce"])
            })
          ])
        );
        const catalog = new LocalAgentCatalogService(config, { appState });
        const missingProviderAgents = await catalog.listAgents({ capabilities: ["repo.summary", "repo.inspect"] });
        expect(missingProviderAgents.agents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "athena-agent.repo-summary",
              available: true,
              providerReadiness: expect.objectContaining({
                status: "missing",
                required: true
              })
            })
          ])
        );
        const missingReviewAgents = await catalog.listAgents({ capabilities: ["code.review", "diff.review"] });
        expect(missingReviewAgents.agents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "athena-agent.pr-diff-review",
              providerReadiness: expect.objectContaining({
                status: "missing",
                required: true
              })
            })
          ])
        );

        appState.connectedRepositories.create({
          id: "target-repo",
          name: "Target Repo",
          sourceType: "existing-path",
          workspacePath: targetRepo,
          status: "ready",
          dirtyState: "clean"
        });
        appState.tasks.create({
          id: "task-athena-agent-summary",
          title: "Summarize with AthenaAgent",
          status: "ready",
          assignedAgentId: "athena-agent.repo-summary",
          assignedAgentVersion: "0.1.0",
          capabilityRequirements: ["repo.summary", "repo.inspect"],
          inputs: {
            repo: {
              id: "target-repo",
              name: "Target Repo",
              sourceType: "existing-path",
              workspacePath: targetRepo,
              status: "ready",
              dirtyState: "clean"
            },
            objective: "Summarize the target repository.",
            focus: "Architecture and entry points.",
            runMode: "read-only"
          }
        });
        const taskWorkbench = new LocalTaskWorkbenchService(config, { appState });
        const missingProviderReadiness = await taskWorkbench.getRunReadiness("task-athena-agent-summary");
        expect(missingProviderReadiness).toMatchObject({
          status: "blocked",
          ready: false,
          checks: expect.arrayContaining([
            expect.objectContaining({
              id: "model-provider",
              category: "provider",
              status: "blocked"
            })
          ])
        });
        await expect(taskWorkbench.runTask("task-athena-agent-summary")).rejects.toThrow("Run readiness blocked");
        expect(appState.runs.list({ targetType: "task", targetId: "task-athena-agent-summary" })).toEqual([]);

        appState.modelProviderConfigs.create({
          id: "fixture-openai",
          name: "Fixture OpenAI-Compatible",
          providerKind: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          defaultModel: "gpt-5.3-codex",
          secretRef: {
            kind: "local-file",
            name: secretFile
          },
          status: "configured",
          statusMessage: "fixture provider configured"
        });

        const agents = await catalog.listAgents({ capabilities: ["repo.summary", "repo.inspect"] });
        expect(agents.agents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "athena-agent.repo-summary",
              available: true,
              providerReadiness: expect.objectContaining({
                status: "configured",
                required: true,
                providerId: "fixture-openai",
                model: "gpt-5.3-codex"
              }),
              metadata: expect.objectContaining({
                observability: expect.objectContaining({
                  strictResultEnvelope: true
                })
              })
            })
          ])
        );
        const run = await taskWorkbench.runTask("task-athena-agent-summary", { runId: "run-athena-agent-summary" });

        expect(run).toMatchObject({
          id: "run-athena-agent-summary",
          status: "completed",
          output: {
            markdown: expect.stringContaining("# AthenaAgent repo-summary"),
            model: "gpt-5.3-codex"
          }
        });
        const detail = await taskWorkbench.getRun("run-athena-agent-summary");
        expect(detail.artifacts).toEqual([
          expect.objectContaining({
            id: "artifact-run-athena-agent-summary-repo-summary",
            label: "AthenaAgent repo-summary",
            kind: "primary",
            format: "markdown",
            storageUri: "memory://athena-agent/run-athena-agent-summary/repo-summary.md",
            metadata: expect.objectContaining({
              contentKey: "markdown",
              repositoryPath: targetRepo,
              agentId: "athena-agent.repo-summary",
              leakedSecret: "[redacted]"
            })
          })
        ]);
        const artifactPreview = await taskWorkbench.getRunArtifact(
          "run-athena-agent-summary",
          "artifact-run-athena-agent-summary-repo-summary"
        );
        expect(artifactPreview.content).toEqual({
          kind: "text",
          text: expect.stringContaining("# AthenaAgent repo-summary"),
          mediaType: "text/markdown"
        });
        expect(JSON.stringify(artifactPreview)).not.toContain("sk-athena-agent-fixture");
        expect(JSON.stringify(detail)).not.toContain("sk-athena-agent-fixture");
        expect(JSON.stringify(appState.runEvents.listForRun("run-athena-agent-summary"))).not.toContain("sk-athena-agent-fixture");
        expect(JSON.stringify(run)).not.toContain("sk-athena-agent-fixture");

        for (const capability of [
          {
            taskId: "task-athena-agent-pr-review",
            runId: "run-athena-agent-pr-review",
            agentId: "athena-agent.pr-diff-review",
            capabilityRequirements: ["code.review", "diff.review"],
            inputs: {
              repo: {
                id: "target-repo",
                name: "Target Repo",
                sourceType: "existing-path",
                workspacePath: targetRepo,
                status: "ready",
                dirtyState: "clean"
              },
              diff: "diff --git a/src/index.ts b/src/index.ts\\n+export const enabled = true;",
              objective: "Review the supplied diff.",
              evidence: "Fixture change."
            }
          },
          {
            taskId: "task-athena-agent-test-triage",
            runId: "run-athena-agent-test-triage",
            agentId: "athena-agent.test-failure-triage",
            capabilityRequirements: ["test.failure.triage", "test.failure.explain"],
            inputs: {
              repo: {
                id: "target-repo",
                name: "Target Repo",
                sourceType: "existing-path",
                workspacePath: targetRepo,
                status: "ready",
                dirtyState: "clean"
              },
              testLog: "FAIL src/index.test.ts\\nExpected true but received false",
              objective: "Triage the failure.",
              evidence: "Fixture test output."
            }
          }
        ]) {
          appState.tasks.create({
            id: capability.taskId,
            title: `Run ${capability.agentId}`,
            status: "ready",
            assignedAgentId: capability.agentId,
            assignedAgentVersion: "0.1.0",
            capabilityRequirements: capability.capabilityRequirements,
            inputs: capability.inputs
          });
          const capabilityRun = await taskWorkbench.runTask(capability.taskId, { runId: capability.runId });
          const slug = capability.agentId.replace("athena-agent.", "");
          expect(capabilityRun).toMatchObject({
            id: capability.runId,
            status: "completed",
            output: {
              markdown: expect.stringContaining(`# AthenaAgent ${slug}`)
            }
          });
          const capabilityDetail = await taskWorkbench.getRun(capability.runId);
          expect(capabilityDetail.artifacts).toEqual([
            expect.objectContaining({
              id: `artifact-${capability.runId}-${slug}`,
              storageUri: `memory://athena-agent/${capability.runId}/${slug}.md`,
              metadata: expect.objectContaining({
                agentId: capability.agentId,
                capability: slug
              })
            })
          ]);
        }

        process.env.ATHENA_AGENT_CONSOLE_RUNNER = JSON.stringify([process.execPath, fakeFailureRunner]);
        appState.tasks.create({
          id: "task-athena-agent-summary-fail",
          title: "Fail with AthenaAgent",
          status: "ready",
          assignedAgentId: "athena-agent.repo-summary",
          assignedAgentVersion: "0.1.0",
          capabilityRequirements: ["repo.summary", "repo.inspect"],
          inputs: {
            repo: {
              id: "target-repo",
              name: "Target Repo",
              sourceType: "existing-path",
              workspacePath: targetRepo,
              status: "ready",
              dirtyState: "clean"
            },
            objective: "Exercise failure redaction.",
            runMode: "read-only"
          }
        });

        const failedRun = await taskWorkbench.runTask("task-athena-agent-summary-fail", { runId: "run-athena-agent-summary-fail" });

        expect(failedRun).toMatchObject({
          id: "run-athena-agent-summary-fail",
          status: "failed",
          failure: {
            phase: "process-exit",
            code: 9,
            stderr: "provider failed with key [redacted]"
          }
        });
        expect(JSON.stringify(failedRun)).not.toContain("sk-athena-agent-fixture");
        expect(JSON.stringify(appState.runEvents.listForRun("run-athena-agent-summary-fail"))).not.toContain("sk-athena-agent-fixture");
      } finally {
        appState.close();
      }
    } finally {
      if (previousRunner === undefined) {
        delete process.env.ATHENA_AGENT_CONSOLE_RUNNER;
      } else {
        process.env.ATHENA_AGENT_CONSOLE_RUNNER = previousRunner;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
