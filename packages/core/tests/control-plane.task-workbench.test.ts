import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalTaskWorkbenchService } from "../src/control-plane/services/task-workbench.js";
import { LocalWorkflowStatusService } from "../src/control-plane/services/workflow-status.js";
import { AthenaError } from "../src/runtime/errors.js";
import { loadConfig } from "../src/shared/config.js";

describe("task workbench service", () => {
  it("creates draft tasks and lists them by status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-draft-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalTaskWorkbenchService(config, { appState });

        const task = await service.create({
          title: "Draft task",
          description: "Manual operator draft",
          capabilityRequirements: ["code.modify"],
          inputs: { brief: "Change the API" },
          createdBy: "operator"
        });

        expect(task).toMatchObject({
          title: "Draft task",
          description: "Manual operator draft",
          status: "draft",
          capabilityRequirements: ["code.modify"],
          inputs: { brief: "Change the API", runMode: "read-only" },
          createdBy: "operator"
        });
        expect(task.id).toMatch(/^task-/);

        const drafts = await service.list({ status: "draft" });
        expect(drafts.total).toBe(1);
        expect(drafts.filters).toEqual({ status: "draft" });
        expect(drafts.tasks[0]?.title).toBe("Draft task");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates ready assignment and compatible capabilities", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-assign-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedCatalog(appState);
        const service = new LocalTaskWorkbenchService(config, { appState });

        await expect(
          service.create({
            title: "Ready without assignment",
            status: "ready"
          })
        ).rejects.toMatchObject({
          code: "CONFIG_ERROR",
          message: "ready tasks require assignedAgentId"
        });

        await expect(
          service.create({
            title: "Incompatible assignment",
            status: "ready",
            assignedAgentId: "software.plan.local",
            capabilityRequirements: ["code.modify"]
          })
        ).rejects.toThrow("does not satisfy capability requirements: code.modify");

        const draft = await service.create({
          id: "task-compatible",
          title: "Compatible assignment",
          capabilityRequirements: ["code.modify"]
        });
        const ready = await service.update(draft.id, {
          status: "ready",
          assignedAgentId: "software.fix.local",
          assignedAgentVersion: "1.0.0"
        });

        expect(ready).toMatchObject({
          id: "task-compatible",
          status: "ready",
          assignedAgentId: "software.fix.local",
          assignedAgentVersion: "1.0.0"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns metadata needed by manual task creation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-metadata-"));
    try {
      const config = loadConfig(dir);
      const service = new LocalTaskWorkbenchService(config);

      await expect(service.get("missing-task")).rejects.toBeInstanceOf(AthenaError);
      await expect(service.metadata()).resolves.toMatchObject({
        defaultStatus: "draft",
        readyRequiresAssignedAgent: true,
        defaultRunMode: "read-only",
        runModes: ["read-only", "propose-changes", "approved-write"],
        statuses: expect.arrayContaining(["draft", "ready", "completed"])
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns bounded task lists through the service without changing response shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-list-bounds-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalTaskWorkbenchService(config, { appState });
        for (let index = 0; index < 520; index += 1) {
          appState.tasks.create({
            id: `task-service-${index.toString().padStart(3, "0")}`,
            title: `Service task ${index}`,
            status: index % 2 === 0 ? "completed" : "draft",
            now: new Date(`2026-01-01T00:${Math.floor(index / 60)
              .toString()
              .padStart(2, "0")}:${(index % 60).toString().padStart(2, "0")}.000Z`)
          });
        }

        const result = await service.list({ status: "completed" });

        expect(result).toMatchObject({
          total: 260,
          filters: { status: "completed" }
        });
        expect(result.tasks).toHaveLength(260);
        expect(result.tasks.every((task) => task.status === "completed")).toBe(true);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs a ready local-command task and persists events, output, artifacts, and status transitions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-run-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "success.js"),
        `
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  process.stdout.write(JSON.stringify({
    output: { summary: envelope.task.inputs.taskBrief, taskId: envelope.task.id },
    verificationStatus: "verification-failed",
    verificationFailures: [
      {
        policyId: "require-test-report",
        kind: "require-evidence",
        message: "Missing required evidence: test-report.",
        details: { label: "test-report", evidenceType: "json" }
      }
    ],
    artifacts: [
      {
        id: "artifact-summary",
        label: "Summary",
        kind: "primary",
        format: "markdown",
        storageUri: "artifacts/run-success/summary.md",
        sizeBytes: 42,
        metadata: { source: "test" }
      }
    ]
  }));
});
`,
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js");
        appState.tasks.create({
          id: "task-run-success",
          title: "Run success",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {
            taskBrief: "Patch the API",
            retryCount: 2
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-success", { runId: "run-success" });
        const detail = await service.getRun("run-success");

        expect(run).toMatchObject({
          id: "run-success",
          targetType: "task",
          targetId: "task-run-success",
          status: "completed",
          backend: "local-process",
          agentId: "software.run.local",
          output: {
            summary: "Patch the API",
            taskId: "task-run-success"
          },
          verificationStatus: "verification-failed",
          verificationFailures: [
            {
              policyId: "require-test-report",
              kind: "require-evidence",
              message: "Missing required evidence: test-report.",
              details: { label: "test-report", evidenceType: "json" }
            }
          ]
        });
        expect(detail.run).toMatchObject({
          id: "run-success",
          status: "completed",
          verificationStatus: "verification-failed",
          verificationFailures: [
            expect.objectContaining({
              policyId: "require-test-report",
              details: { label: "test-report", evidenceType: "json" }
            })
          ]
        });
        expect(detail.task).toMatchObject({ id: "task-run-success", status: "completed" });
        expect(detail.events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.validated", "run.started", "run.log", "artifact.created", "run.completed"])
        );
        expect(detail.artifacts).toEqual([
          expect.objectContaining({
            id: "artifact-summary",
            label: "Summary",
            storageUri: "artifacts/run-success/summary.md"
          })
        ]);
        expect(appState.tasks.get("task-run-success")).toMatchObject({ status: "completed" });
        expect(appState.runEvents.listForRun("run-success").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.validated", "run.started", "run.log", "artifact.created", "run.completed"])
        );
        expect(appState.artifacts.listForRun("run-success")).toEqual([
          expect.objectContaining({
            id: "artifact-summary",
            label: "Summary",
            storageUri: "artifacts/run-success/summary.md",
            metadata: { source: "test" }
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates linked workflow DAG steps when workflow-template task runs complete", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-workflow-dag-success-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "workflow-success.js"),
        "process.stdout.write(JSON.stringify({ output: { summary: 'workflow step complete' }, artifacts: [] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "workflow-success.js");
        appState.workflowDagRuns.create({
          id: "workflow-run-linked-success",
          workflowTemplateId: "linked.workflow",
          workflowTemplateVersion: "1.0.0",
          stepOrder: ["plan", "review"],
          dependencies: {
            plan: [],
            review: ["plan"]
          }
        });
        appState.tasks.create({
          id: "task-linked-plan",
          title: "Linked plan",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Complete linked plan" },
          provenance: {
            source: "workflow-template",
            workflowDagRunId: "workflow-run-linked-success",
            workflowDagStepId: "plan",
            workflowTemplateId: "linked.workflow",
            templateTaskId: "plan"
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });
        const statusService = new LocalWorkflowStatusService(config, { appState });

        const run = await service.runTask("task-linked-plan", { runId: "run-linked-plan" });
        const status = await statusService.getStatus("workflow-run-linked-success");

        expect(run).toMatchObject({ id: "run-linked-plan", status: "completed" });
        expect(status.run).toMatchObject({ id: "workflow-run-linked-success", status: "running" });
        expect(status.progress).toMatchObject({
          totalSteps: 2,
          completedSteps: 1,
          runningSteps: 0,
          pendingSteps: 1,
          readySteps: 1,
          percentComplete: 50
        });
        expect(status.nodes.find((node) => node.id === "plan")).toMatchObject({
          status: "completed",
          attempt: 1,
          output: {
            taskRunId: "run-linked-plan",
            taskId: "task-linked-plan",
            status: "completed",
            output: { summary: "workflow step complete" },
            artifactCount: 0,
            execution: expect.objectContaining({
              backend: "local-process",
              agentId: "software.run.local"
            })
          }
        });
        expect(status.nodes.find((node) => node.id === "review")).toMatchObject({
          status: "pending",
          ready: true,
          blockingStepIds: []
        });
        expect(status.events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["workflow.step.started", "workflow.step.completed"])
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists proposed-change artifacts without applying file mutations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-proposed-change-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "propose-change.js"),
        `
process.stdout.write(JSON.stringify({
  output: { summary: "Proposed one file change." },
  artifacts: [
    {
      id: "proposed-change-readme",
      label: "Proposed README change",
      kind: "proposed-change",
      format: "diff",
      storageUri: "artifacts/proposed/readme.diff",
      metadata: {
        artifactType: "proposed-changes",
        runMode: "propose-changes",
        applyAvailable: false,
        summary: "One README edit proposed.",
        proposedChanges: [
          {
            path: "README.md",
            changeType: "modify",
            diff: ["@@ -1 +1 @@", "-old", "+new"].join("\\n")
          }
        ]
      }
    }
  ]
}));
`,
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "propose-change.js");
        const service = new LocalTaskWorkbenchService(config, { appState });
        await service.create({
          id: "task-run-propose-change",
          title: "Propose change",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {
            taskBrief: "Propose README edit",
            runMode: "propose-changes"
          }
        });

        const run = await service.runTask("task-run-propose-change", { runId: "run-propose-change" });
        const artifacts = appState.artifacts.listForRun("run-propose-change");
        const events = appState.runEvents.listForRun("run-propose-change");

        expect(run).toMatchObject({
          status: "completed",
          output: { summary: "Proposed one file change." }
        });
        expect(events.find((event) => event.type === "run.mode")?.payload).toMatchObject({
          runMode: "propose-changes",
          applyAvailable: false
        });
        expect(artifacts).toEqual([
          expect.objectContaining({
            id: "proposed-change-readme",
            kind: "proposed-change",
            format: "diff",
            metadata: expect.objectContaining({
              artifactType: "proposed-changes",
              applyAvailable: false,
              proposedChanges: [
                {
                  path: "README.md",
                  changeType: "modify",
                  diff: "@@ -1 +1 @@\n-old\n+new"
                }
              ]
            })
          })
        ]);
        expect(appState.tasks.get("task-run-propose-change")).toMatchObject({ status: "completed" });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects local task runs when manifest-required inputs are missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-run-input-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.exit(0);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js");
        appState.tasks.create({
          id: "task-run-missing-input",
          title: "Run missing input",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {}
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        await expect(service.runTask("task-run-missing-input")).rejects.toThrow("task.inputs.taskBrief is required");
        expect(appState.runs.list({ targetType: "task", targetId: "task-run-missing-input" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks approved-write run mode until approvals can apply mutations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-run-mode-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js");
        const service = new LocalTaskWorkbenchService(config, { appState });
        const task = await service.create({
          id: "task-run-approved-write",
          title: "Approved write placeholder",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {
            taskBrief: "Patch the API",
            runMode: "approved-write"
          }
        });

        expect(task.inputs).toMatchObject({ runMode: "approved-write" });
        const readiness = await service.getRunReadiness("task-run-approved-write");

        expect(readiness).toMatchObject({
          status: "blocked",
          ready: false
        });
        expect(readiness.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "run-mode",
              category: "permissions",
              status: "blocked",
              message: "Approved write mode is not available until approval implementation exists."
            })
          ])
        );
        await expect(service.runTask("task-run-approved-write")).rejects.toThrow("Approved write mode is not available");
        expect(appState.runs.list({ targetType: "task", targetId: "task-run-approved-write" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports run readiness gates for repo, provider, runtime, and permissions without exposing secrets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-readiness-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.exit(0);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js", {
          approvalRequiredFor: ["network-write"],
          modelProvider: {
            required: true,
            providerId: "openai-main",
            providerKind: "openai-compatible",
            model: "gpt-4.1-mini"
          }
        });
        appState.connectedRepositories.create({
          id: "repo-missing",
          name: "Missing Repo",
          sourceType: "existing-path",
          workspacePath: join(dir, "missing-repo"),
          status: "missing",
          statusMessage: "Path does not exist."
        });
        appState.tasks.create({
          id: "task-run-readiness-blocked",
          title: "Run readiness blocked",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {
            taskBrief: "Patch the API",
            repo: {
              id: "repo-missing",
              name: "Missing Repo",
              workspacePath: join(dir, "missing-repo"),
              status: "missing"
            },
            repoPath: join(dir, "missing-repo")
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const task = await service.get("task-run-readiness-blocked");
        const readiness = await service.getRunReadiness("task-run-readiness-blocked");

        expect(task.runReadiness).toEqual(readiness);
        expect(readiness).toMatchObject({
          status: "blocked",
          ready: false
        });
        expect(readiness.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "repo-context", category: "repo", status: "blocked" }),
            expect.objectContaining({ id: "model-provider", category: "provider", status: "blocked" }),
            expect.objectContaining({ id: "runtime", category: "runtime", status: "ok" }),
            expect.objectContaining({ id: "permissions", category: "permissions", status: "warning" })
          ])
        );
        expect(JSON.stringify(readiness)).not.toContain("OPENAI_API_KEY");
        await expect(service.runTask("task-run-readiness-blocked")).rejects.toThrow("Run readiness blocked");
        expect(appState.runs.list({ targetType: "task", targetId: "task-run-readiness-blocked" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes connected repository context to the runtime repo path contract", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-repo-contract-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "assert-repo-path.js"),
        [
          "let body = '';",
          "process.stdin.on('data', (chunk) => body += chunk);",
          "process.stdin.on('end', () => {",
          "  const envelope = JSON.parse(body);",
          "  if (!envelope.task?.inputs?.repo?.path) {",
          "    console.error('missing repo.path');",
          "    process.exit(1);",
          "  }",
          "  process.stdout.write(JSON.stringify({ output: { repoPath: envelope.task.inputs.repo.path }, artifacts: [] }));",
          "});"
        ].join("\n"),
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "assert-repo-path.js");
        const workspacePath = join(dir, "target-repo");
        mkdirSync(workspacePath, { recursive: true });
        appState.connectedRepositories.create({
          id: "repo-ready",
          name: "Ready Repo",
          sourceType: "existing-path",
          workspacePath,
          status: "ready"
        });
        appState.tasks.create({
          id: "task-repo-contract",
          title: "Repo contract",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          inputs: {
            taskBrief: "Patch the API",
            repo: {
              id: "repo-ready",
              name: "Ready Repo",
              workspacePath,
              status: "ready"
            }
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const readiness = await service.getRunReadiness("task-repo-contract");
        const run = await service.runTask("task-repo-contract");

        expect(readiness).toMatchObject({
          status: "ready",
          ready: true
        });
        expect(run).toMatchObject({
          status: "completed",
          output: {
            repoPath: workspacePath
          }
        });
        expect(appState.tasks.get("task-repo-contract")?.inputs).toMatchObject({
          repo: {
            id: "repo-ready",
            workspacePath
          }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks ready repository records whose workspace path is inaccessible to the runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-repo-runtime-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.exit(0);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js");
        const workspacePath = join(dir, "missing-runtime-path");
        appState.connectedRepositories.create({
          id: "repo-stale-ready",
          name: "Stale Ready Repo",
          sourceType: "existing-path",
          workspacePath,
          status: "ready"
        });
        appState.tasks.create({
          id: "task-repo-runtime-blocked",
          title: "Repo runtime blocked",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          inputs: {
            taskBrief: "Patch the API",
            repo: {
              id: "repo-stale-ready",
              name: "Stale Ready Repo",
              workspacePath,
              status: "ready"
            }
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const readiness = await service.getRunReadiness("task-repo-runtime-blocked");

        expect(readiness).toMatchObject({
          status: "blocked",
          ready: false
        });
        expect(readiness.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: "repo-context",
              status: "blocked",
              message: `Repository path is not accessible to this runtime: ${workspacePath}.`
            })
          ])
        );
        await expect(service.runTask("task-repo-runtime-blocked")).rejects.toThrow("Run readiness blocked");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks runs when the assigned agent has no runnable runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-readiness-runtime-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedCatalog(appState);
        appState.tasks.create({
          id: "task-run-no-runtime",
          title: "Run no runtime",
          status: "ready",
          assignedAgentId: "software.fix.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: {}
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const readiness = await service.getRunReadiness("task-run-no-runtime");

        expect(readiness).toMatchObject({
          status: "blocked",
          ready: false
        });
        expect(readiness.checks).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: "runtime", category: "runtime", status: "blocked" })])
        );
        await expect(service.runTask("task-run-no-runtime")).rejects.toThrow("Task runs currently require");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs a ready container-command task and persists events, output, artifacts, and status transitions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-run-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "container-success.js"),
        `
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  process.stdout.write(JSON.stringify({
    output: { summary: envelope.task.inputs.taskBrief, backend: "container" },
    artifacts: [
      {
        id: "container-artifact",
        label: "Container Summary",
        kind: "primary",
        format: "markdown",
        storageUri: "artifacts/run-container/summary.md",
        sizeBytes: 84,
        metadata: { source: "container-test" }
      }
    ]
  }));
});
`,
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "container-success.js", { policyPackId: "container-isolated" });
        appState.tasks.create({
          id: "task-run-container",
          title: "Run container",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Patch from a container" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-container", { runId: "run-container" });

        expect(run).toMatchObject({
          id: "run-container",
          status: "completed",
          backend: "container-command",
          output: {
            summary: "Patch from a container",
            backend: "container"
          }
        });
        expect(appState.tasks.get("task-run-container")).toMatchObject({ status: "completed" });
        const events = appState.runEvents.listForRun("run-container");
        expect(events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.validated", "run.started", "run.log", "artifact.created", "run.completed"])
        );
        expect(events.find((event) => event.type === "run.safety.limits")?.payload).toMatchObject({
          policyPackId: "container-isolated",
          approvalRequiredFor: ["container-control"]
        });
        expect(appState.artifacts.listForRun("run-container")).toEqual([
          expect.objectContaining({
            id: "container-artifact",
            label: "Container Summary",
            storageUri: "artifacts/run-container/summary.md",
            metadata: { source: "container-test" }
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects container-command runs when the working directory escapes the plugin root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-cwd-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.exit(0);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "success.js", { workingDirectory: "../outside" });
        appState.tasks.create({
          id: "task-run-container-escape",
          title: "Run container escape",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Escape please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        await expect(service.runTask("task-run-container-escape")).rejects.toThrow(
          "runtime.workingDirectory must stay inside the plugin directory."
        );
        expect(appState.runs.list({ targetType: "task", targetId: "task-run-container-escape" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks container-command runs failed when artifact metadata escapes the artifact boundary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-artifact-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "bad-artifact.js"),
        "process.stdout.write(JSON.stringify({ output: {}, artifacts: [{ label: 'Bad', kind: 'primary', format: 'text', storageUri: '../escape.txt' }] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "bad-artifact.js");
        appState.tasks.create({
          id: "task-run-container-bad-artifact",
          title: "Run container bad artifact",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Bad artifact please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-container-bad-artifact", { runId: "run-container-bad-artifact" });

        expect(run).toMatchObject({
          status: "failed",
          failure: {
            phase: "artifact"
          }
        });
        expect(appState.tasks.get("task-run-container-bad-artifact")).toMatchObject({ status: "failed" });
        expect(appState.artifacts.listForRun("run-container-bad-artifact")).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks container-command runs failed when the command exits non-zero", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-fail-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "container-fail.js"), "process.stderr.write('container boom'); process.exit(9);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "container-fail.js");
        appState.tasks.create({
          id: "task-run-container-fail",
          title: "Run container fail",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Fail please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-container-fail", { runId: "run-container-fail" });

        expect(run).toMatchObject({
          status: "failed",
          backend: "container-command",
          failure: {
            code: 9,
            stderr: "container boom"
          }
        });
        expect(appState.tasks.get("task-run-container-fail")).toMatchObject({ status: "failed" });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports cancellation for an active container-command task run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-cancel-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "container-slow.js"), "setTimeout(() => process.stdout.write('{}'), 5000);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "container-slow.js");
        appState.tasks.create({
          id: "task-run-container-cancel",
          title: "Run container cancel",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const runPromise = service.runTask("task-run-container-cancel", { runId: "run-container-cancel" });
        const cancel = await service.cancelRun("run-container-cancel", { reason: "operator-request" });
        const run = await runPromise;

        expect(cancel).toEqual({ runId: "run-container-cancel", status: "cancelled" });
        expect(run).toMatchObject({ status: "cancelled", backend: "container-command" });
        expect(appState.tasks.get("task-run-container-cancel")).toMatchObject({ status: "cancelled" });
        expect(appState.runEvents.listForRun("run-container-cancel").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.cancel.requested", "run.cancelled"])
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs a ready HTTP/API task and persists response metadata, output, artifacts, and status transitions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-http-run-"));
    const received: Array<{ method?: string; headers: IncomingMessage["headers"]; body: unknown }> = [];
    const server = await startHttpApiServer((request, body, response) => {
      const parsed = JSON.parse(body) as { task: { id: string; inputs?: { taskBrief?: string } }; run: { id: string } };
      received.push({ method: request.method, headers: request.headers, body: parsed });
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          output: {
            summary: parsed.task.inputs?.taskBrief,
            taskId: parsed.task.id,
            runId: parsed.run.id
          },
          artifacts: [
            {
              id: "http-artifact",
              label: "HTTP Summary",
              kind: "primary",
              format: "json",
              storageUri: "remote://agent/run-http/summary.json",
              metadata: { source: "http-test" }
            }
          ]
        })
      );
    });
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedHttpApiCatalog(appState, server.url);
        appState.tasks.create({
          id: "task-run-http",
          title: "Run HTTP",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Patch via API" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-http", { runId: "run-http" });

        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({
          method: "POST",
          headers: expect.objectContaining({
            "content-type": "application/json",
            accept: "application/json, text/plain",
            "x-agent-token": "test-token"
          }),
          body: expect.objectContaining({
            task: expect.objectContaining({ id: "task-run-http", inputs: { taskBrief: "Patch via API" } }),
            agent: { id: "software.http.local", version: "1.0.0" },
            run: { id: "run-http" }
          })
        });
        expect(run).toMatchObject({
          id: "run-http",
          status: "completed",
          backend: "http-api",
          output: {
            summary: "Patch via API",
            taskId: "task-run-http",
            runId: "run-http"
          }
        });
        expect(appState.tasks.get("task-run-http")).toMatchObject({ status: "completed" });
        expect(appState.runEvents.listForRun("run-http").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.validated", "run.started", "run.response", "artifact.created", "run.completed"])
        );
        expect(appState.artifacts.listForRun("run-http")).toEqual([
          expect.objectContaining({
            id: "http-artifact",
            label: "HTTP Summary",
            storageUri: "remote://agent/run-http/summary.json",
            metadata: { source: "http-test" }
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects HTTP/API task runs when URL, method, headers, environment, or backend preferences are invalid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-http-validate-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const service = new LocalTaskWorkbenchService(config, { appState });

        seedHttpApiCatalog(appState, "not-a-url");
        appState.tasks.create({
          id: "task-run-http-bad-url",
          title: "Bad HTTP URL",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Validate URL" }
        });
        await expect(service.runTask("task-run-http-bad-url")).rejects.toThrow("HTTP/API implementation.url must be an absolute HTTP(S) URL.");

        seedHttpApiCatalog(appState, "http://127.0.0.1:9/run", { method: "GET" });
        await expect(service.runTask("task-run-http-bad-url")).rejects.toThrow("HTTP/API implementation.method must be POST, PUT, or PATCH.");

        seedHttpApiCatalog(appState, "http://127.0.0.1:9/run", { headers: { Host: "example.test" } });
        await expect(service.runTask("task-run-http-bad-url")).rejects.toThrow("HTTP/API implementation.headers.Host is not allowed.");

        seedHttpApiCatalog(appState, "http://127.0.0.1:9/run", { environment: { TOKEN: 123 } });
        await expect(service.runTask("task-run-http-bad-url")).rejects.toThrow("HTTP/API environment.TOKEN must be a string.");

        seedHttpApiCatalog(appState, "http://127.0.0.1:9/run", { preferredBackend: "local-process" });
        await expect(service.runTask("task-run-http-bad-url")).rejects.toThrow("Assigned agent does not declare http-api runtime compatibility.");

        expect(appState.runs.list({ targetType: "task", targetId: "task-run-http-bad-url" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks HTTP/API task runs failed when the endpoint returns a non-OK response", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-http-fail-"));
    const server = await startHttpApiServer((_request, _body, response) => {
      response.statusCode = 500;
      response.statusMessage = "Remote Failure";
      response.end("remote boom");
    });
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedHttpApiCatalog(appState, server.url);
        appState.tasks.create({
          id: "task-run-http-fail",
          title: "Run HTTP fail",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Fail via API" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-http-fail", { runId: "run-http-fail" });

        expect(run).toMatchObject({
          status: "failed",
          backend: "http-api",
          failure: {
            status: 500,
            statusText: "Remote Failure",
            body: "remote boom"
          }
        });
        expect(appState.tasks.get("task-run-http-fail")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-http-fail").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.response", "run.failed"])
        );
      } finally {
        appState.close();
      }
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records unsupported cancellation for active HTTP/API task runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-http-cancel-"));
    let releaseResponse: () => void = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const server = await startHttpApiServer(async (_request, _body, response) => {
      await responseGate;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ output: { completedAfterCancelRequest: true }, artifacts: [] }));
    });
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedHttpApiCatalog(appState, server.url);
        appState.tasks.create({
          id: "task-run-http-cancel",
          title: "Run HTTP cancel",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait via API" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const runPromise = service.runTask("task-run-http-cancel", { runId: "run-http-cancel" });
        const cancel = await service.cancelRun("run-http-cancel", { reason: "operator-request" });
        releaseResponse();
        const run = await runPromise;

        expect(cancel).toEqual({ runId: "run-http-cancel", status: "unsupported" });
        expect(run).toMatchObject({
          status: "completed",
          backend: "http-api",
          output: { completedAfterCancelRequest: true }
        });
        expect(appState.tasks.get("task-run-http-cancel")).toMatchObject({ status: "completed" });
        expect(appState.runEvents.listForRun("run-http-cancel").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.cancel.requested", "run.cancel.unsupported", "run.response", "run.completed"])
        );
      } finally {
        appState.close();
      }
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops local-process task runs when the max runtime limit is exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-local-runtime-limit-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "too-slow.js"), "setInterval(() => {}, 1000);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "too-slow.js", { limits: { maxRuntimeSeconds: 1, maxToolCalls: 80 } });
        appState.tasks.create({
          id: "task-run-local-runtime-limit",
          title: "Run local too long",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait too long" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-local-runtime-limit", { runId: "run-local-runtime-limit" });

        expect(run).toMatchObject({
          status: "stopped-by-limit",
          backend: "local-process",
          failure: {
            limitType: "maxRuntimeSeconds",
            threshold: 1,
            backend: "local-process"
          },
          safetyStop: {
            limitType: "maxRuntimeSeconds",
            threshold: 1,
            backend: "local-process"
          }
        });
        expect(appState.tasks.get("task-run-local-runtime-limit")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-local-runtime-limit").map((event) => event.type)).toContain("run.stopped-by-limit");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops container-command task runs when the max runtime limit is exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-container-runtime-limit-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "container-too-slow.js"), "setInterval(() => {}, 1000);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedContainerRunnableCatalog(appState, pluginDir, "container-too-slow.js", {
          limits: { maxRuntimeSeconds: 1, maxToolCalls: 80 }
        });
        appState.tasks.create({
          id: "task-run-container-runtime-limit",
          title: "Run container too long",
          status: "ready",
          assignedAgentId: "software.container.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait too long in container" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-container-runtime-limit", { runId: "run-container-runtime-limit" });

        expect(run).toMatchObject({
          status: "stopped-by-limit",
          backend: "container-command",
          safetyStop: {
            limitType: "maxRuntimeSeconds",
            threshold: 1,
            backend: "container-command"
          }
        });
        expect(appState.tasks.get("task-run-container-runtime-limit")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-container-runtime-limit").map((event) => event.type)).toContain("run.stopped-by-limit");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops HTTP/API task runs when the max runtime limit is exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-http-runtime-limit-"));
    let releaseResponse: () => void = () => {};
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    const server = await startHttpApiServer(async (_request, _body, response) => {
      await responseGate;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ output: { tooLate: true }, artifacts: [] }));
    });
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedHttpApiCatalog(appState, server.url, { limits: { maxRuntimeSeconds: 1, maxToolCalls: 80 } });
        appState.tasks.create({
          id: "task-run-http-runtime-limit",
          title: "Run HTTP too long",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait via API too long" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-http-runtime-limit", { runId: "run-http-runtime-limit" });

        expect(run).toMatchObject({
          status: "stopped-by-limit",
          backend: "http-api",
          safetyStop: {
            limitType: "maxRuntimeSeconds",
            threshold: 1,
            backend: "http-api"
          }
        });
        expect(appState.tasks.get("task-run-http-runtime-limit")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-http-runtime-limit").map((event) => event.type)).toContain("run.stopped-by-limit");
      } finally {
        appState.close();
      }
    } finally {
      releaseResponse();
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops task runs when observable output or artifact limits are exceeded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-envelope-limits-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "large-output.js"),
        "process.stdout.write(JSON.stringify({ output: { summary: 'too much output' }, artifacts: [] }));",
        "utf8"
      );
      writeFileSync(
        join(pluginDir, "too-many-artifacts.js"),
        "process.stdout.write(JSON.stringify({ output: {}, artifacts: [{ label: 'Extra', kind: 'primary', format: 'text', storageUri: 'artifacts/extra.txt' }] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "large-output.js", {
          limits: { maxRuntimeSeconds: 900, maxToolCalls: 80, maxOutputBytes: 4 }
        });
        appState.tasks.create({
          id: "task-run-output-limit",
          title: "Run output limit",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Return too much" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const outputRun = await service.runTask("task-run-output-limit", { runId: "run-output-limit" });

        expect(outputRun).toMatchObject({
          status: "stopped-by-limit",
          safetyStop: {
            limitType: "maxOutputBytes",
            threshold: 4,
            backend: "local-process"
          }
        });
        expect(appState.artifacts.listForRun("run-output-limit")).toEqual([]);

        seedRunnableCatalog(appState, pluginDir, "too-many-artifacts.js", {
          limits: { maxRuntimeSeconds: 900, maxToolCalls: 80, maxArtifacts: 0 }
        });
        appState.tasks.create({
          id: "task-run-artifact-limit",
          title: "Run artifact limit",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Return artifacts" }
        });

        const artifactRun = await service.runTask("task-run-artifact-limit", { runId: "run-artifact-limit" });

        expect(artifactRun).toMatchObject({
          status: "stopped-by-limit",
          safetyStop: {
            limitType: "maxArtifacts",
            threshold: 0,
            observed: 1,
            backend: "local-process"
          }
        });
        expect(appState.artifacts.listForRun("run-artifact-limit")).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records approval-required events and default limits without blocking successful runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-approval-events-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js", {
          approvalRequiredFor: ["network-write", "shell-command"]
        });
        appState.tasks.create({
          id: "task-run-approval-events",
          title: "Run approval events",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Record approval sensitivity" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-approval-events", { runId: "run-approval-events" });
        const events = appState.runEvents.listForRun("run-approval-events");
        const limitsEvent = events.find((event) => event.type === "run.safety.limits");
        const approvalEvents = events.filter((event) => event.type === "run.approval.required");

        expect(run).toMatchObject({ status: "completed", backend: "local-process", output: { ok: true } });
        expect(limitsEvent?.payload).toMatchObject({
          policyPackId: "standard-local",
          limits: {
            maxRuntimeSeconds: 900,
            maxToolCalls: 80,
            maxRepeatedActions: 3,
            maxRetries: 2,
            maxFollowUpTasks: 5
          }
        });
        expect(approvalEvents.map((event) => event.payload)).toEqual([
          expect.objectContaining({ action: "task.run", riskClass: "network-write", decision: "pending" }),
          expect.objectContaining({ action: "task.run", riskClass: "shell-command", decision: "pending" })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves runtime policy packs into stricter limits and approval unions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-policy-pack-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "success.js"), "process.stdout.write(JSON.stringify({ output: '', artifacts: [] }));", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "success.js", {
          policyPackId: "cautious-local",
          limits: {
            maxRuntimeSeconds: 600,
            maxToolCalls: 100,
            maxRepeatedActions: 3,
            maxRetries: 4,
            maxFollowUpTasks: 3,
            maxOutputBytes: 4,
            maxArtifacts: 10
          },
          approvalRequiredFor: ["network-write", "shell-command"]
        });
        appState.tasks.create({
          id: "task-run-policy-pack",
          title: "Run policy pack",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Resolve policy pack" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        await service.runTask("task-run-policy-pack", { runId: "run-policy-pack" });

        const events = appState.runEvents.listForRun("run-policy-pack");
        const limitsEvent = events.find((event) => event.type === "run.safety.limits");
        const approvalEvents = events.filter((event) => event.type === "run.approval.required");

        expect(limitsEvent?.payload).toMatchObject({
          policyPackId: "cautious-local",
          limits: {
            maxRuntimeSeconds: 300,
            maxToolCalls: 40,
            maxRepeatedActions: 2,
            maxRetries: 1,
            maxFollowUpTasks: 2,
            maxOutputBytes: 4,
            maxArtifacts: 5
          },
          approvalRequiredFor: ["credential-access", "network-write", "shell-command"]
        });
        expect(approvalEvents.map((event) => event.payload)).toEqual([
          expect.objectContaining({ action: "task.run", riskClass: "credential-access", decision: "pending" }),
          expect.objectContaining({ action: "task.run", riskClass: "network-write", decision: "pending" }),
          expect.objectContaining({ action: "task.run", riskClass: "shell-command", decision: "pending" })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects runs when a runtime policy pack disallows the resolved backend", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-policy-pack-backend-"));
    const server = await startHttpApiServer((_request, _body, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ output: { ok: true } }));
    });
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedHttpApiCatalog(appState, server.url, { policyPackId: "cautious-local" });
        appState.tasks.create({
          id: "task-run-policy-pack-backend",
          title: "Run policy pack backend",
          status: "ready",
          assignedAgentId: "software.http.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Reject backend" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        await expect(service.runTask("task-run-policy-pack-backend")).rejects.toThrow(
          "Runtime policy pack cautious-local does not allow http-api backend."
        );
        expect(appState.runs.list({ targetType: "task", targetId: "task-run-policy-pack-backend" })).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks task runs failed when the local command exits non-zero", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-run-fail-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "fail.js"), "process.stderr.write('boom'); process.exit(7);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "fail.js");
        appState.tasks.create({
          id: "task-run-fail",
          title: "Run fail",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Fail please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const run = await service.runTask("task-run-fail", { runId: "run-fail" });

        expect(run).toMatchObject({
          id: "run-fail",
          status: "failed",
          failure: {
            code: 7,
            stderr: "boom"
          }
        });
        expect(appState.tasks.get("task-run-fail")).toMatchObject({ status: "failed" });
        expect(appState.runEvents.listForRun("run-fail").map((event) => event.type)).toContain("run.failed");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates linked workflow DAG steps when workflow-template task runs fail", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-workflow-dag-fail-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "workflow-fail.js"), "process.stderr.write('workflow boom'); process.exit(9);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "workflow-fail.js");
        appState.workflowDagRuns.create({
          id: "workflow-run-linked-fail",
          workflowTemplateId: "linked.workflow",
          workflowTemplateVersion: "1.0.0",
          stepOrder: ["plan", "review"],
          dependencies: {
            plan: [],
            review: ["plan"]
          }
        });
        appState.tasks.create({
          id: "task-linked-fail-plan",
          title: "Linked plan failure",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Fail linked plan" },
          provenance: {
            source: "workflow-template",
            workflowDagRunId: "workflow-run-linked-fail",
            workflowDagStepId: "plan",
            workflowTemplateId: "linked.workflow",
            templateTaskId: "plan"
          }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });
        const statusService = new LocalWorkflowStatusService(config, { appState });

        const run = await service.runTask("task-linked-fail-plan", { runId: "run-linked-fail-plan" });
        const status = await statusService.getStatus("workflow-run-linked-fail");

        expect(run).toMatchObject({
          id: "run-linked-fail-plan",
          status: "failed",
          failure: {
            code: 9,
            stderr: "workflow boom"
          }
        });
        expect(status.run).toMatchObject({
          id: "workflow-run-linked-fail",
          status: "failed",
          failure: {
            stepId: "plan",
            detail: {
              taskRunId: "run-linked-fail-plan",
              taskId: "task-linked-fail-plan",
              status: "failed"
            }
          }
        });
        expect(status.progress).toMatchObject({
          totalSteps: 2,
          completedSteps: 0,
          failedSteps: 1,
          pendingSteps: 1,
          blockedSteps: 1
        });
        expect(status.nodes.find((node) => node.id === "plan")).toMatchObject({
          status: "failed",
          failure: {
            taskRunId: "run-linked-fail-plan",
            taskId: "task-linked-fail-plan",
            status: "failed",
            failure: {
              code: 9,
              stderr: "workflow boom"
            },
            execution: expect.objectContaining({
              backend: "local-process",
              agentId: "software.run.local"
            })
          }
        });
        expect(status.nodes.find((node) => node.id === "review")).toMatchObject({
          status: "pending",
          ready: false,
          blockingStepIds: ["plan"]
        });
        expect(status.events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["workflow.step.started", "workflow.step.failed"])
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports cancellation for an active local task run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-workbench-run-cancel-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "slow.js"), "setTimeout(() => process.stdout.write('{}'), 5000);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableCatalog(appState, pluginDir, "slow.js");
        appState.tasks.create({
          id: "task-run-cancel",
          title: "Run cancel",
          status: "ready",
          assignedAgentId: "software.run.local",
          assignedAgentVersion: "1.0.0",
          capabilityRequirements: ["code.modify"],
          inputs: { taskBrief: "Wait please" }
        });
        const service = new LocalTaskWorkbenchService(config, { appState });

        const runPromise = service.runTask("task-run-cancel", { runId: "run-cancel" });
        const cancel = await service.cancelRun("run-cancel", { reason: "operator-request" });
        const run = await runPromise;

        expect(cancel).toEqual({ runId: "run-cancel", status: "cancelled" });
        expect(run.status).toBe("cancelled");
        expect(appState.tasks.get("task-run-cancel")).toMatchObject({ status: "cancelled" });
        expect(appState.runEvents.listForRun("run-cancel").map((event) => event.type)).toEqual(
          expect.arrayContaining(["run.cancel.requested", "run.cancelled"])
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedCatalog(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.software",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-plugin",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Software Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.fix.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.software",
    pluginVersion: "0.1.0",
    name: "Software Fixer",
    capabilities: ["code.modify", "text.summarize"],
    status: "loaded",
    manifest: {}
  });
  appState.agents.upsert({
    id: "software.plan.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.software",
    pluginVersion: "0.1.0",
    name: "Software Planner",
    capabilities: ["task.plan"],
    status: "loaded",
    manifest: {}
  });
}

function seedRunnableCatalog(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  options: {
    limits?: Record<string, unknown>;
    approvalRequiredFor?: string[];
    policyPackId?: string;
    modelProvider?: Record<string, unknown>;
  } = {}
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.runnable",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Runnable Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.run.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.runnable",
    pluginVersion: "0.1.0",
    name: "Software Runner",
    capabilities: ["code.modify", "tests.run"],
    status: "loaded",
    manifest: {
      agent: {
        inputs: {
          taskBrief: {
            type: "markdown",
            required: true
          },
          retryCount: {
            type: "integer",
            required: false
          }
        },
        implementation: {
          type: "local-command",
          command: process.execPath,
          args: [scriptName]
        },
        runtime: {
          preferredBackend: "local-process",
          workingDirectory: ".",
          ...(options.policyPackId ? { policyPackId: options.policyPackId } : {}),
          ...(options.modelProvider ? { modelProvider: options.modelProvider } : {})
        },
        ...(options.limits ? { limits: options.limits } : {}),
        ...(options.approvalRequiredFor ? { permissions: { approvalRequiredFor: options.approvalRequiredFor } } : {})
      }
    }
  });
}

function seedContainerRunnableCatalog(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  options: { workingDirectory?: string; limits?: Record<string, unknown>; approvalRequiredFor?: string[]; policyPackId?: string } = {}
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.container",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Container Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.container.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.container",
    pluginVersion: "0.1.0",
    name: "Software Container Runner",
    capabilities: ["code.modify", "tests.run"],
    status: "loaded",
    manifest: {
      agent: {
        inputs: {
          taskBrief: {
            type: "markdown",
            required: true
          }
        },
        implementation: {
          type: "container-command",
          image: "team-orchestrator/test-runner:latest",
          command: process.execPath,
          args: [scriptName]
        },
        runtime: {
          preferredBackend: "container-command",
          workingDirectory: options.workingDirectory ?? ".",
          ...(options.policyPackId ? { policyPackId: options.policyPackId } : {}),
          environment: {
            CONTAINER_TEST: "true"
          }
        },
        permissions: {
          containers: "allow",
          ...(options.approvalRequiredFor ? { approvalRequiredFor: options.approvalRequiredFor } : {})
        },
        ...(options.limits ? { limits: options.limits } : {})
      }
    }
  });
}

function seedHttpApiCatalog(
  appState: ReturnType<typeof openAppStateDatabase>,
  url: string,
  options: {
    type?: string;
    method?: string;
    headers?: Record<string, unknown>;
    environment?: Record<string, unknown>;
    preferredBackend?: string;
    limits?: Record<string, unknown>;
    approvalRequiredFor?: string[];
    policyPackId?: string;
  } = {}
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.http",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-http-plugin",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "HTTP Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.http.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.http",
    pluginVersion: "0.1.0",
    name: "Software HTTP Runner",
    capabilities: ["code.modify", "tests.run"],
    status: "loaded",
    manifest: {
      agent: {
        inputs: {
          taskBrief: {
            type: "markdown",
            required: true
          }
        },
        implementation: {
          type: options.type ?? "http-api",
          url,
          method: options.method ?? "POST",
          headers: options.headers ?? { "x-agent-token": "test-token" }
        },
        runtime: {
          preferredBackend: options.preferredBackend ?? "http-api",
          ...(options.policyPackId ? { policyPackId: options.policyPackId } : {}),
          environment: options.environment ?? {
            HTTP_TOKEN: "test-token"
          }
        },
        ...(options.limits ? { limits: options.limits } : {}),
        ...(options.approvalRequiredFor ? { permissions: { approvalRequiredFor: options.approvalRequiredFor } } : {})
      }
    }
  });
}

async function startHttpApiServer(
  handler: (request: IncomingMessage, body: string, response: ServerResponse) => void | Promise<void>
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    void (async () => {
      const body = await readRequestBody(request);
      await handler(request, body, response);
    })().catch((error) => {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : String(error));
    });
  });
  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("HTTP test server did not bind to a TCP port.");
  }
  return {
    url: `http://127.0.0.1:${(address as AddressInfo).port}/run`,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      })
  };
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("error", rejectBody);
    request.on("end", () => {
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
  });
}
