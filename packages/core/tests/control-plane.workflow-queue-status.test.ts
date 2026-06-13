import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowQueueStatusService } from "../src/control-plane/services/workflow-queue-status.js";
import { LocalWorkflowStateService } from "../src/control-plane/services/workflow-state.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow queue status", () => {
  it("classifies pending, running, retryable, and stuck workflow work", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-queue-status-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedQueueStatusFixtures(appState);
        const service = new LocalWorkflowQueueStatusService(config, { appState });

        const status = service.getStatus({
          at: "2026-06-13T01:00:30.000Z",
          staleAfterMs: 20_000
        });

        expect(status.summary).toMatchObject({
          pending: 1,
          running: 1,
          retryable: 1,
          stuck: 1,
          workersActive: 1,
          workersExpired: 1
        });
        expect(status.items.map((item) => ({ state: item.state, workflowRunId: item.workflowRunId, stepId: item.stepId }))).toEqual(
          expect.arrayContaining([
            { state: "pending", workflowRunId: "workflow-run-pending", stepId: "plan" },
            { state: "running", workflowRunId: "workflow-run-running", stepId: "plan" },
            { state: "retryable", workflowRunId: "workflow-run-retryable", stepId: "plan" },
            { state: "stuck", workflowRunId: "workflow-run-stuck", stepId: "plan" }
          ])
        );
        expect(status.items.find((item) => item.workflowRunId === "workflow-run-running")).toMatchObject({
          state: "running",
          taskId: "task-running",
          taskRunId: "run-running",
          workerId: "worker-active"
        });
        expect(status.items.find((item) => item.workflowRunId === "workflow-run-retryable")).toMatchObject({
          state: "retryable",
          attempt: 1,
          maxAttempts: 2,
          reason: "retry-policy-allows-next-attempt"
        });
        expect(status.items.find((item) => item.workflowRunId === "workflow-run-stuck")).toMatchObject({
          state: "stuck",
          reason: "stale-worker-heartbeat",
          workerId: "worker-expired"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes workflow queue status through the API", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-queue-status-"));
    const config = loadConfig(dir);
    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
    const appState = openAppStateDatabase(config);
    try {
      seedQueueStatusFixtures(appState);
    } finally {
      appState.close();
    }
    let bound: { host: string; port: number };
    try {
      bound = await server.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }

    try {
      const response = await fetch(
        `http://${bound.host}:${bound.port}/api/v1/workflow-queue/status?at=${encodeURIComponent("2026-06-13T01:00:30.000Z")}&staleAfterMs=20000`
      );
      expect(response.status).toBe(200);
      const envelope = (await response.json()) as {
        ok: boolean;
        data: {
          summary: { pending: number; running: number; retryable: number; stuck: number };
          items: Array<{ state: string; workflowRunId: string; reason?: string }>;
        };
      };

      expect(envelope.ok).toBe(true);
      expect(envelope.data.summary).toMatchObject({
        pending: 1,
        running: 1,
        retryable: 1,
        stuck: 1
      });
      expect(envelope.data.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ state: "pending", workflowRunId: "workflow-run-pending" }),
          expect.objectContaining({ state: "running", workflowRunId: "workflow-run-running" }),
          expect.objectContaining({ state: "retryable", workflowRunId: "workflow-run-retryable" }),
          expect.objectContaining({ state: "stuck", workflowRunId: "workflow-run-stuck", reason: "stale-worker-heartbeat" })
        ])
      );
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedQueueStatusFixtures(appState: ReturnType<typeof openAppStateDatabase>): void {
  const stateService = new LocalWorkflowStateService(appState);
  stateService.createRun({
    runId: "workflow-run-pending",
    workflowTemplateId: "queue.pending.workflow",
    tasks: [{ id: "plan" }],
    now: new Date("2026-06-13T00:59:00.000Z")
  });

  createWorkflowTask(appState, {
    id: "task-running",
    workflowRunId: "workflow-run-running",
    workflowTemplateId: "queue.running.workflow"
  });
  stateService.createRun({
    runId: "workflow-run-running",
    workflowTemplateId: "queue.running.workflow",
    tasks: [{ id: "plan" }],
    now: new Date("2026-06-13T00:59:00.000Z")
  });
  stateService.startStep("workflow-run-running", "plan", new Date("2026-06-13T01:00:20.000Z"));
  appState.tasks.update("task-running", { status: "running", now: new Date("2026-06-13T01:00:20.000Z") });
  appState.runs.create({
    id: "run-running",
    targetType: "task",
    targetId: "task-running",
    status: "running",
    startedAt: "2026-06-13T01:00:20.000Z",
    now: new Date("2026-06-13T01:00:20.000Z")
  });
  appState.workerHeartbeats.upsert({
    workerId: "worker-active",
    identity: { host: "worker-active" },
    activeRunId: "run-running",
    capacity: 2,
    version: "0.1.0",
    now: new Date("2026-06-13T01:00:25.000Z"),
    ttlMs: 60_000
  });

  createWorkflowTask(appState, {
    id: "task-retryable",
    workflowRunId: "workflow-run-retryable",
    workflowTemplateId: "queue.retryable.workflow",
    retryPolicy: {
      maxAttempts: 2,
      retryableFailurePhases: ["execution"],
      idempotency: "idempotent",
      externalWriteRetry: "allow"
    }
  });
  stateService.createRun({
    runId: "workflow-run-retryable",
    workflowTemplateId: "queue.retryable.workflow",
    tasks: [{ id: "plan" }],
    now: new Date("2026-06-13T00:59:00.000Z")
  });
  stateService.startStep("workflow-run-retryable", "plan", new Date("2026-06-13T01:00:00.000Z"));
  appState.runs.create({
    id: "run-retryable-failed",
    targetType: "task",
    targetId: "task-retryable",
    status: "failed",
    failure: { phase: "process-exit", code: 7 },
    now: new Date("2026-06-13T01:00:05.000Z")
  });
  stateService.failStep(
    "workflow-run-retryable",
    "plan",
    {
      taskRunId: "run-retryable-failed",
      taskId: "task-retryable",
      status: "failed",
      failure: { phase: "process-exit", code: 7 }
    },
    new Date("2026-06-13T01:00:05.000Z")
  );

  createWorkflowTask(appState, {
    id: "task-stuck",
    workflowRunId: "workflow-run-stuck",
    workflowTemplateId: "queue.stuck.workflow"
  });
  stateService.createRun({
    runId: "workflow-run-stuck",
    workflowTemplateId: "queue.stuck.workflow",
    tasks: [{ id: "plan" }],
    now: new Date("2026-06-13T00:59:00.000Z")
  });
  stateService.startStep("workflow-run-stuck", "plan", new Date("2026-06-13T00:59:40.000Z"));
  appState.tasks.update("task-stuck", { status: "running", now: new Date("2026-06-13T00:59:40.000Z") });
  appState.runs.create({
    id: "run-stuck",
    targetType: "task",
    targetId: "task-stuck",
    status: "running",
    startedAt: "2026-06-13T00:59:40.000Z",
    now: new Date("2026-06-13T00:59:40.000Z")
  });
  appState.workerHeartbeats.upsert({
    workerId: "worker-expired",
    identity: { host: "worker-expired" },
    activeRunId: "run-stuck",
    capacity: 1,
    version: "0.1.0",
    now: new Date("2026-06-13T00:59:40.000Z"),
    ttlMs: 10_000
  });
}

function createWorkflowTask(
  appState: ReturnType<typeof openAppStateDatabase>,
  options: {
    id: string;
    workflowRunId: string;
    workflowTemplateId: string;
    retryPolicy?: Record<string, unknown>;
  }
): void {
  appState.tasks.create({
    id: options.id,
    title: options.id,
    status: "ready",
    assignedAgentId: "queue.agent",
    capabilityRequirements: ["queue.run"],
    inputs: { taskBrief: options.id },
    provenance: {
      source: "workflow-template",
      workflowTemplateId: options.workflowTemplateId,
      templateTaskId: "plan",
      workflowDagRunId: options.workflowRunId,
      workflowDagStepId: "plan",
      ...(options.retryPolicy ? { retryPolicy: options.retryPolicy } : {})
    },
    now: new Date("2026-06-13T00:59:00.000Z")
  });
}
