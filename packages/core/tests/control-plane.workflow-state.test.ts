import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowStateService } from "../src/control-plane/services/workflow-state.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow DAG state store", () => {
  it("creates durable run and step state from workflow template dependencies", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-state-create-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const service = new LocalWorkflowStateService(appState);

        const created = service.createRun({
          runId: "workflow-run-podcast",
          workflowTemplateId: "podcast.workflow",
          workflowTemplateVersion: "1.0.0",
          pluginId: "podcast.plugin",
          pluginVersion: "1.0.0",
          tasks: [
            { id: "publish", dependsOn: ["notes"] },
            { id: "transcribe" },
            { id: "notes", dependsOn: ["transcribe"] }
          ]
        });

        expect(created.run).toMatchObject({
          id: "workflow-run-podcast",
          workflowTemplateId: "podcast.workflow",
          status: "pending",
          stepOrder: ["transcribe", "notes", "publish"],
          dependencies: {
            transcribe: [],
            notes: ["transcribe"],
            publish: ["notes"]
          }
        });
        expect(created.steps.map((step) => ({ id: step.stepId, ready: step.ready, blocking: step.blockingStepIds }))).toEqual([
          { id: "transcribe", ready: true, blocking: [] },
          { id: "notes", ready: false, blocking: ["transcribe"] },
          { id: "publish", ready: false, blocking: ["notes"] }
        ]);

        const reopened = openAppStateDatabase(loadConfig(dir));
        try {
          const loaded = new LocalWorkflowStateService(reopened).requireRun("workflow-run-podcast");
          expect(loaded.run.stepOrder).toEqual(["transcribe", "notes", "publish"]);
          expect(loaded.events.map((event) => event.type)).toContain("workflow.created");
        } finally {
          reopened.close();
        }
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates readiness, attempts, failures, and resume state", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-state-resume-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const service = new LocalWorkflowStateService(appState);
        service.createRun({
          runId: "workflow-run-research",
          workflowTemplateId: "research.workflow",
          tasks: [{ id: "collect" }, { id: "summarize", dependsOn: ["collect"] }, { id: "review", dependsOn: ["summarize"] }]
        });

        service.startStep("workflow-run-research", "collect");
        const afterCollect = service.completeStep("workflow-run-research", "collect", { artifactId: "artifact-collect" });
        expect(afterCollect.steps.find((step) => step.stepId === "summarize")).toMatchObject({
          status: "pending",
          ready: true,
          blockingStepIds: []
        });

        service.startStep("workflow-run-research", "summarize");
        const failed = service.failStep("workflow-run-research", "summarize", { message: "model timeout" });
        expect(failed.run).toMatchObject({
          status: "failed",
          failure: {
            stepId: "summarize",
            detail: { message: "model timeout" }
          }
        });
        expect(failed.steps.find((step) => step.stepId === "summarize")).toMatchObject({
          status: "failed",
          attempt: 1,
          failure: { message: "model timeout" }
        });

        const resumable = service.resumeFromFirstFailedStep("workflow-run-research");
        expect(resumable.run.status).toBe("pending");
        expect(resumable.steps.find((step) => step.stepId === "collect")?.status).toBe("completed");
        expect(resumable.steps.find((step) => step.stepId === "summarize")).toMatchObject({
          status: "pending",
          attempt: 1,
          ready: true
        });
        expect(resumable.steps.find((step) => step.stepId === "review")).toMatchObject({
          status: "pending",
          ready: false,
          blockingStepIds: ["summarize"]
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers stale running steps into a resumable failed state after restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-state-stale-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        const service = new LocalWorkflowStateService(appState);
        service.createRun({
          runId: "workflow-run-stale",
          workflowTemplateId: "stale.workflow",
          tasks: [{ id: "download" }, { id: "process", dependsOn: ["download"] }]
        });

        service.startStep("workflow-run-stale", "download");
      } finally {
        appState.close();
      }

      const reopened = openAppStateDatabase(loadConfig(dir));
      try {
        const service = new LocalWorkflowStateService(reopened);
        const recovered = service.recoverStaleRunningSteps("workflow-run-stale");
        expect(recovered.run).toMatchObject({
          status: "resumable",
          failure: {
            code: "STALE_RUNNING_STEPS",
            stepIds: ["download"]
          }
        });
        expect(recovered.steps.find((step) => step.stepId === "download")).toMatchObject({
          status: "failed",
          failure: {
            code: "STALE_RUNNING_STEP"
          }
        });
        expect(recovered.events.map((event) => event.type)).toContain("workflow.recovered_stale_steps");
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
