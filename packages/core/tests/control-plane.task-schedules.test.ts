import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalScheduleService } from "../src/control-plane/services/local-services.js";
import type { ExecutionBackend } from "../src/control-plane/backends.js";
import type { PolicyService } from "../src/control-plane/interfaces.js";
import { loadConfig } from "../src/shared/config.js";

describe("task schedule service", () => {
  it("creates, gets, lists, updates, and deletes task-target schedules in app state", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedReadyTask(appState, "task-scheduled");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        const created = await service.upsert({
          id: "schedule-task",
          name: "Run task later",
          targetType: "task",
          targetId: "task-scheduled",
          inputBindings: { priority: "normal" },
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "America/Los_Angeles"
        });

        expect(created).toMatchObject({
          id: "schedule-task",
          name: "Run task later",
          targetType: "task",
          targetId: "task-scheduled",
          inputBindings: { priority: "normal" },
          timezone: "America/Los_Angeles",
          status: "active",
          nextRunAt: "2026-06-01T09:00:00.000Z"
        });
        await expect(service.get("schedule-task")).resolves.toMatchObject({ id: "schedule-task" });
        await expect(service.list()).resolves.toEqual([expect.objectContaining({ id: "schedule-task" })]);

        const updated = await service.upsert({
          id: "schedule-task",
          name: "Run task daily",
          targetType: "task",
          targetId: "task-scheduled",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC",
          status: "paused",
          failurePolicy: { overlap: "skip-if-running" }
        });

        expect(updated).toMatchObject({
          id: "schedule-task",
          name: "Run task daily",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC",
          status: "paused",
          failurePolicy: { overlap: "skip-if-running" }
        });
        await expect(service.remove("schedule-task")).resolves.toBe(true);
        await expect(service.get("schedule-task")).resolves.toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs due one-shot task schedules through the task workbench", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-due-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "success.js"),
        "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTask(appState, pluginDir, "success.js", "task-due");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });
        await service.upsert({
          id: "schedule-due",
          name: "Run due task",
          targetType: "task",
          targetId: "task-due",
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        });

        const result = await service.runDue(new Date("2026-06-01T09:00:00.000Z"));
        const updatedSchedule = appState.schedules.require("schedule-due");
        const runId = updatedSchedule.lastRunId;

        expect(result.skipped).toBe(0);
        expect(result.run).toEqual([
          expect.objectContaining({
            id: "schedule-due",
            status: "ok",
            targetType: "task",
            targetId: "task-due",
            runId
          })
        ]);
        expect(updatedSchedule.status).toBe("disabled");
        expect(updatedSchedule.nextRunAt).toBeUndefined();
        expect(runId).toBeTruthy();
        expect(appState.runs.require(runId ?? "")).toMatchObject({
          targetType: "task",
          targetId: "task-due",
          status: "completed"
        });
        expect(appState.runEvents.listForRun(runId ?? "").map((event) => event.type)).toContain("schedule.run.linked");
        await expect(service.logs("schedule-due")).resolves.toEqual([
          expect.objectContaining({
            scheduleId: "schedule-due",
            sessionId: "task-due",
            status: "ok",
            targetType: "task",
            targetId: "task-due",
            runId
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips non-due task schedules", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-not-due-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedReadyTask(appState, "task-not-due");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });
        await service.upsert({
          id: "schedule-not-due",
          targetType: "task",
          targetId: "task-not-due",
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        });

        const result = await service.runDue(new Date("2026-06-01T08:59:59.000Z"));

        expect(result).toEqual({ run: [], skipped: 1 });
        const unchangedSchedule = appState.schedules.require("schedule-not-due");
        expect(unchangedSchedule).toMatchObject({
          status: "active",
          nextRunAt: "2026-06-01T09:00:00.000Z"
        });
        expect(unchangedSchedule.lastRunId).toBeUndefined();
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks failed scheduled task runs as schedule errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-failed-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "fail.js"), "process.stderr.write('boom'); process.exit(7);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTask(appState, pluginDir, "fail.js", "task-fails");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });
        await service.upsert({
          id: "schedule-fails",
          targetType: "task",
          targetId: "task-fails",
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        });

        const result = await service.runDue(new Date("2026-06-01T09:00:00.000Z"));
        const updatedSchedule = appState.schedules.require("schedule-fails");

        expect(result.run[0]).toMatchObject({
          id: "schedule-fails",
          status: "failed",
          reason: "task-run-failed"
        });
        expect(updatedSchedule).toMatchObject({
          status: "error",
          failurePolicy: {
            overlap: "skip-if-running",
            lastAttempt: expect.objectContaining({ status: "failed", runStatus: "failed" })
          }
        });
        expect(updatedSchedule.lastRunId).toBeTruthy();
        await expect(service.logs("schedule-fails")).resolves.toEqual([
          expect.objectContaining({
            scheduleId: "schedule-fails",
            status: "failed",
            targetType: "task",
            targetId: "task-fails",
            runId: updatedSchedule.lastRunId,
            reason: "task-run-failed"
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("advances recurring task schedules past missed occurrences", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-recurring-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "success.js"),
        "process.stdout.write(JSON.stringify({ output: { ok: true }, artifacts: [] }));",
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedRunnableTask(appState, pluginDir, "success.js", "task-recurs");
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });
        await service.upsert({
          id: "schedule-recurs",
          targetType: "task",
          targetId: "task-recurs",
          runAt: "2026-06-01T09:00:00.000Z",
          rrule: "FREQ=DAILY;INTERVAL=1",
          timezone: "UTC"
        });

        const result = await service.runDue(new Date("2026-06-04T12:00:00.000Z"));
        const updatedSchedule = appState.schedules.require("schedule-recurs");

        expect(result.run[0]).toMatchObject({
          id: "schedule-recurs",
          status: "ok",
          missedRunAt: "2026-06-01T09:00:00.000Z",
          nextRunAt: "2026-06-05T09:00:00.000Z"
        });
        expect(updatedSchedule).toMatchObject({
          status: "active",
          nextRunAt: "2026-06-05T09:00:00.000Z"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("instantiates workflow-template schedules into fresh missions and tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-schedule-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedWorkflowTemplateScheduleTarget(appState);
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        const created = await service.upsert({
          id: "schedule-release-workflow",
          name: "Release workflow",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
          inputBindings: {
            version: "0.1.0",
            pluginId: "team-orchestrator.test.scheduler-templates",
            pluginVersion: "0.1.0",
            inputs: { releaseName: "v2.0.0" }
          },
          runAt: "2026-06-01T09:00:00.000Z",
          timezone: "UTC"
        });

        expect(created).toMatchObject({
          id: "schedule-release-workflow",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
          inputBindings: {
            version: "0.1.0",
            inputs: { releaseName: "v2.0.0" }
          }
        });

        const result = await service.runDue(new Date("2026-06-01T09:00:00.000Z"));
        const run = result.run[0];
        const updatedSchedule = appState.schedules.require("schedule-release-workflow");

        expect(run).toMatchObject({
          id: "schedule-release-workflow",
          status: "ok",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
          workflowDagRunId: expect.stringMatching(/^workflow-run-mission-/),
          missionId: expect.stringMatching(/^mission-/),
          taskIds: expect.arrayContaining([expect.stringMatching(/^mission-.*-plan$/)])
        });
        expect(result.skipped).toBe(0);
        expect(updatedSchedule.status).toBe("disabled");
        expect(appState.missions.require(run?.missionId ?? "")).toMatchObject({
          goal: "Prepare release v2.0.0.",
          status: "ready"
        });
        expect(appState.workflowDagRuns.requireSnapshot(run?.workflowDagRunId ?? "").run).toMatchObject({
          id: run?.workflowDagRunId,
          workflowTemplateId: "templates.release.workflow",
          status: "pending"
        });
        expect(appState.tasks.require(run?.taskIds?.[0] ?? "")).toMatchObject({
          missionId: run?.missionId,
          inputs: { release: "v2.0.0" },
          createdBy: "schedule:schedule-release-workflow"
        });
        expect(updatedSchedule.failurePolicy).toMatchObject({
          lastAttempt: {
            status: "ok",
            missionId: run?.missionId,
            workflowDagRunId: run?.workflowDagRunId,
            taskIds: run?.taskIds
          }
        });
        await expect(service.logs("schedule-release-workflow")).resolves.toEqual([
          expect.objectContaining({
            scheduleId: "schedule-release-workflow",
            sessionId: run?.missionId,
            status: "ok",
            targetType: "workflow-template",
            targetId: "templates.release.workflow",
            workflowDagRunId: run?.workflowDagRunId,
            missionId: run?.missionId,
            taskIds: run?.taskIds
          })
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates scheduled task targets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-task-schedule-invalid-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-draft",
          title: "Draft task"
        });
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        await expect(
          service.upsert({
            id: "schedule-missing",
            targetType: "task",
            targetId: "task-missing",
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
        await expect(
          service.upsert({
            id: "schedule-draft",
            targetType: "task",
            targetId: "task-draft",
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toThrow("must be ready");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validates scheduled workflow-template targets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-schedule-invalid-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedWorkflowTemplateScheduleTarget(appState);
        const service = new LocalScheduleService(config, noopBackend, noopPolicyService, { appState });

        await expect(
          service.upsert({
            id: "schedule-missing-template",
            targetType: "workflow-template",
            targetId: "templates.missing.workflow",
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
        await expect(
          service.upsert({
            id: "schedule-bad-inputs",
            targetType: "workflow-template",
            targetId: "templates.release.workflow",
            inputBindings: { inputs: "not-object" },
            runAt: "2026-06-01T09:00:00.000Z"
          })
        ).rejects.toThrow("inputBindings.inputs must be an object");
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedReadyTask(appState: ReturnType<typeof openAppStateDatabase>, taskId: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.scheduler",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-test-scheduler",
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "scheduler.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.scheduler",
    pluginVersion: "0.1.0",
    name: "Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {},
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "Scheduled task",
    status: "ready",
    assignedAgentId: "scheduler.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}

function seedRunnableTask(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  taskId: string
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.scheduler-runnable",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: { plugin: { name: "Runnable Scheduler Test" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "scheduler.runnable.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.scheduler-runnable",
    pluginVersion: "0.1.0",
    name: "Runnable Scheduler Agent",
    capabilities: ["test.run"],
    manifest: {
      agent: {
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
    },
    status: "loaded"
  });
  appState.tasks.create({
    id: taskId,
    title: "Scheduled runnable task",
    status: "ready",
    assignedAgentId: "scheduler.runnable.agent",
    assignedAgentVersion: "1.0.0",
    capabilityRequirements: ["test.run"]
  });
}

function seedWorkflowTemplateScheduleTarget(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.scheduler-templates",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-scheduler-template-plugin",
    enabled: true,
    sourceType: "local",
    status: "loaded",
    manifest: { plugin: { name: "Scheduler Template Plugin" } },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "scheduler.template.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.scheduler-templates",
    pluginVersion: "0.1.0",
    name: "Scheduler Template Agent",
    capabilities: ["release.plan"],
    manifest: {},
    status: "loaded"
  });
  appState.workflowTemplates.upsert({
    id: "templates.release.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.scheduler-templates",
    pluginVersion: "0.1.0",
    name: "Release Workflow",
    description: "Prepare a release.",
    taskCount: 1,
    manifest: {
      workflow: {
        id: "templates.release.workflow",
        name: "Release Workflow",
        version: "0.1.0",
        goal: "Prepare release {{releaseName}}.",
        inputs: {
          releaseName: { required: true }
        },
        tasks: [
          {
            id: "plan",
            title: "Plan {{releaseName}}",
            capabilityRequirements: ["release.plan"],
            assignedAgentId: "scheduler.template.agent",
            assignedAgentVersion: "1.0.0",
            inputs: {
              release: "{{releaseName}}"
            }
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}

const noopBackend: ExecutionBackend = {
  kind: "local",
  async run() {
    return {
      sessionId: "noop",
      output: "",
      runId: "noop",
      provider: "noop",
      model: "noop",
      createdAt: new Date().toISOString()
    };
  },
  async cancel() {
    return { sessionId: "noop", status: "not-running" };
  }
};

const noopPolicyService = {
  async get() {
    return undefined;
  }
} as PolicyService;
