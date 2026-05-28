import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowStateService } from "../src/control-plane/services/workflow-state.js";
import { LocalWorkflowStatusService } from "../src/control-plane/services/workflow-status.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow run graph status", () => {
  it("maps durable workflow run state into a graph-friendly status shape", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-status-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const stateService = new LocalWorkflowStateService(appState);
        const statusService = new LocalWorkflowStatusService(config, { appState });
        stateService.createRun({
          runId: "workflow-run-status",
          workflowTemplateId: "status.workflow",
          workflowTemplateVersion: "1.0.0",
          pluginId: "status.plugin",
          pluginVersion: "1.0.0",
          tasks: [{ id: "extract" }, { id: "transform", dependsOn: ["extract"] }, { id: "publish", dependsOn: ["transform"] }]
        });

        stateService.startStep("workflow-run-status", "extract");
        stateService.completeStep("workflow-run-status", "extract", { artifactRef: "artifact-extract" });
        stateService.startStep("workflow-run-status", "transform");
        stateService.failStep("workflow-run-status", "transform", { code: "MODEL_TIMEOUT", message: "Timed out" });

        const status = await statusService.getStatus("workflow-run-status");

        expect(status.run).toMatchObject({
          id: "workflow-run-status",
          status: "failed",
          workflowTemplate: {
            id: "status.workflow",
            version: "1.0.0",
            pluginId: "status.plugin",
            pluginVersion: "1.0.0"
          }
        });
        expect(status.progress).toMatchObject({
          totalSteps: 3,
          completedSteps: 1,
          failedSteps: 1,
          pendingSteps: 1,
          blockedSteps: 1,
          percentComplete: 33
        });
        expect(status.edges).toEqual([
          { from: "extract", to: "transform" },
          { from: "transform", to: "publish" }
        ]);
        expect(status.nodes.find((node) => node.id === "extract")).toMatchObject({
          status: "completed",
          dependents: ["transform"],
          output: { artifactRef: "artifact-extract" }
        });
        expect(status.nodes.find((node) => node.id === "transform")).toMatchObject({
          status: "failed",
          attempt: 1,
          dependencies: ["extract"],
          blockingStepIds: [],
          failure: { code: "MODEL_TIMEOUT", message: "Timed out" },
          recovery: { resumable: true, reason: "failed" }
        });
        expect(status.nodes.find((node) => node.id === "publish")).toMatchObject({
          status: "pending",
          ready: false,
          blockingStepIds: ["transform"],
          readiness: {
            totalDependencies: 1,
            readyDependencies: 0,
            blocked: true
          }
        });
        expect(status.recovery).toMatchObject({
          resumable: true,
          failedStepIds: ["transform"],
          staleRecoveredStepIds: []
        });
        expect(status.events.map((event) => event.type)).toEqual(
          expect.arrayContaining(["workflow.created", "workflow.step.started", "workflow.step.completed", "workflow.step.failed"])
        );
        expect(status.polling).toMatchObject({
          recommendedIntervalMs: 5_000,
          etag: expect.any(String)
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes workflow run status through the API for console polling", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workflow-status-"));
    const config = loadConfig(dir);
    const appState = openAppStateDatabase(config);
    try {
      const stateService = new LocalWorkflowStateService(appState);
      stateService.createRun({
        runId: "workflow-run-api-status",
        workflowTemplateId: "api.status.workflow",
        tasks: [{ id: "plan" }, { id: "review", dependsOn: ["plan"] }]
      });
      stateService.startStep("workflow-run-api-status", "plan");
      stateService.completeStep("workflow-run-api-status", "plan", { artifactRef: "artifact-plan" });
    } finally {
      appState.close();
    }

    const server = createApiServer({
      config,
      host: "127.0.0.1",
      port: 0
    });
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
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const response = await fetch(`${base}/api/v1/workflow-runs/workflow-run-api-status/status`);
      expect(response.status).toBe(200);
      const envelope = (await response.json()) as {
        ok: boolean;
        data: {
          run: { id: string; workflowTemplate: { id: string } };
          nodes: Array<{ id: string; ready: boolean; dependencies: string[] }>;
          edges: Array<{ from: string; to: string }>;
          polling: { recommendedIntervalMs: number; etag: string };
        };
      };

      expect(envelope).toMatchObject({
        ok: true,
        data: {
          run: {
            id: "workflow-run-api-status",
            workflowTemplate: { id: "api.status.workflow" }
          },
          edges: [{ from: "plan", to: "review" }],
          polling: {
            recommendedIntervalMs: 1_000,
            etag: expect.any(String)
          }
        }
      });
      expect(envelope.data.nodes.find((node) => node.id === "review")).toMatchObject({
        ready: true,
        dependencies: ["plan"]
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
