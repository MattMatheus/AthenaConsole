import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalTaskWorkbenchService } from "../src/control-plane/services/task-workbench.js";
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
          inputs: { brief: "Change the API" },
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
        statuses: expect.arrayContaining(["draft", "ready", "completed"])
      });
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
          }
        });
        expect(detail.run).toMatchObject({ id: "run-success", status: "completed" });
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

function seedRunnableCatalog(appState: ReturnType<typeof openAppStateDatabase>, pluginDir: string, scriptName: string): void {
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
          workingDirectory: "."
        }
      }
    }
  });
}
