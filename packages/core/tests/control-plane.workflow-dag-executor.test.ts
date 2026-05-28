import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowDagExecutorService } from "../src/control-plane/services/workflow-dag-executor.js";
import { LocalWorkflowStatusService } from "../src/control-plane/services/workflow-status.js";
import { LocalWorkflowTemplateCatalogService } from "../src/control-plane/services/workflow-template-catalog.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow DAG executor service", () => {
  it("executes projected workflow-template tasks in deterministic DAG readiness order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-dag-executor-success-"));
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
    output: { taskId: envelope.task.id, step: envelope.task.provenance.workflowDagStepId },
    artifacts: []
  }));
});
`,
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedExecutableWorkflowTemplate(appState, pluginDir, "success.js", {
          workflowTemplateId: "executor.success.workflow",
          agentId: "executor.success.agent"
        });
        const templateCatalog = new LocalWorkflowTemplateCatalogService(config, { appState });
        const instantiation = await templateCatalog.instantiate("executor.success.workflow", {
          missionId: "mission-executor-success",
          taskIdPrefix: "executor-success"
        });
        const executor = new LocalWorkflowDagExecutorService(config, { appState });
        const statusService = new LocalWorkflowStatusService(config, { appState });

        const result = await executor.execute(instantiation.workflowDagRun.id);
        const status = await statusService.getStatus(instantiation.workflowDagRun.id);

        expect(result).toMatchObject({
          runId: "workflow-run-mission-executor-success",
          status: "completed",
          executedStepIds: ["plan", "review"]
        });
        expect(status.progress).toMatchObject({
          totalSteps: 2,
          completedSteps: 2,
          failedSteps: 0,
          percentComplete: 100
        });
        expect(status.nodes.map((node) => ({ id: node.id, status: node.status }))).toEqual([
          { id: "plan", status: "completed" },
          { id: "review", status: "completed" }
        ]);
        expect(status.nodes.find((node) => node.id === "plan")?.output).toMatchObject({
          taskId: "executor-success-plan",
          status: "completed",
          output: {
            taskId: "executor-success-plan",
            step: "plan"
          }
        });
        expect(status.nodes.find((node) => node.id === "review")?.output).toMatchObject({
          taskId: "executor-success-review",
          status: "completed",
          output: {
            taskId: "executor-success-review",
            step: "review"
          }
        });
        expect(appState.tasks.get("executor-success-plan")).toMatchObject({ status: "completed" });
        expect(appState.tasks.get("executor-success-review")).toMatchObject({ status: "completed" });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops after a failed projected task and leaves dependents blocked", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-dag-executor-fail-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(join(pluginDir, "fail.js"), "process.stderr.write('executor boom'); process.exit(5);", "utf8");
      const appState = openAppStateDatabase(config);
      try {
        seedExecutableWorkflowTemplate(appState, pluginDir, "fail.js", {
          workflowTemplateId: "executor.fail.workflow",
          agentId: "executor.fail.agent"
        });
        const templateCatalog = new LocalWorkflowTemplateCatalogService(config, { appState });
        const instantiation = await templateCatalog.instantiate("executor.fail.workflow", {
          missionId: "mission-executor-fail",
          taskIdPrefix: "executor-fail"
        });
        const executor = new LocalWorkflowDagExecutorService(config, { appState });
        const statusService = new LocalWorkflowStatusService(config, { appState });

        const result = await executor.execute(instantiation.workflowDagRun.id);
        const status = await statusService.getStatus(instantiation.workflowDagRun.id);

        expect(result).toMatchObject({
          runId: "workflow-run-mission-executor-fail",
          status: "failed",
          executedStepIds: ["plan"]
        });
        expect(status.progress).toMatchObject({
          completedSteps: 0,
          failedSteps: 1,
          pendingSteps: 1,
          blockedSteps: 1
        });
        expect(status.nodes.find((node) => node.id === "plan")).toMatchObject({
          status: "failed",
          failure: {
            taskId: "executor-fail-plan",
            status: "failed",
            failure: {
              code: 5,
              stderr: "executor boom"
            }
          }
        });
        expect(status.nodes.find((node) => node.id === "review")).toMatchObject({
          status: "pending",
          ready: false,
          blockingStepIds: ["plan"]
        });
        expect(appState.tasks.get("executor-fail-review")).toMatchObject({ status: "ready" });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resumes failed workflow DAG runs without re-running completed dependencies", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-dag-executor-resume-"));
    try {
      const config = loadConfig(dir);
      const pluginDir = join(dir, "plugin");
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, "fail-review-once.js"),
        `
const { appendFileSync, existsSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  const step = envelope.task.provenance.workflowDagStepId;
  appendFileSync(join(__dirname, "attempts.log"), step + "\\n");
  const marker = join(__dirname, "review-failed-once");
  if (step === "review" && !existsSync(marker)) {
    writeFileSync(marker, "failed");
    process.stderr.write("review failed once");
    process.exit(7);
  }
  process.stdout.write(JSON.stringify({
    output: { taskId: envelope.task.id, step },
    artifacts: []
  }));
});
`,
        "utf8"
      );
      const appState = openAppStateDatabase(config);
      try {
        seedExecutableWorkflowTemplate(appState, pluginDir, "fail-review-once.js", {
          workflowTemplateId: "executor.resume.workflow",
          agentId: "executor.resume.agent"
        });
        const templateCatalog = new LocalWorkflowTemplateCatalogService(config, { appState });
        const instantiation = await templateCatalog.instantiate("executor.resume.workflow", {
          missionId: "mission-executor-resume",
          taskIdPrefix: "executor-resume"
        });
        const executor = new LocalWorkflowDagExecutorService(config, { appState });
        const statusService = new LocalWorkflowStatusService(config, { appState });

        const failed = await executor.execute(instantiation.workflowDagRun.id);
        const resumed = await executor.resume(instantiation.workflowDagRun.id);
        const status = await statusService.getStatus(instantiation.workflowDagRun.id);
        const attempts = readFileSync(join(pluginDir, "attempts.log"), "utf8").trim().split("\n");

        expect(failed).toMatchObject({
          status: "failed",
          executedStepIds: ["plan", "review"]
        });
        expect(resumed).toMatchObject({
          status: "completed",
          executedStepIds: ["review"]
        });
        expect(attempts).toEqual(["plan", "review", "review"]);
        expect(status.progress).toMatchObject({
          completedSteps: 2,
          failedSteps: 0,
          percentComplete: 100
        });
        expect(status.events.map((event) => event.type)).toContain("workflow.resume.prepared");
        expect(status.nodes.find((node) => node.id === "plan")).toMatchObject({
          status: "completed",
          attempt: 1
        });
        expect(status.nodes.find((node) => node.id === "review")).toMatchObject({
          status: "completed",
          attempt: 2
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedExecutableWorkflowTemplate(
  appState: ReturnType<typeof openAppStateDatabase>,
  pluginDir: string,
  scriptName: string,
  options: { workflowTemplateId: string; agentId: string }
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.workflow-dag-executor",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    sourceType: "local",
    status: "loaded",
    manifest: {
      schemaVersion: 1,
      plugin: {
        id: "team-orchestrator.test.workflow-dag-executor",
        name: "Workflow DAG Executor Test",
        version: "0.1.0"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: options.agentId,
    version: "1.0.0",
    pluginId: "team-orchestrator.test.workflow-dag-executor",
    pluginVersion: "0.1.0",
    name: "Workflow DAG Executor Agent",
    capabilities: ["workflow.execute"],
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
  appState.workflowTemplates.upsert({
    id: options.workflowTemplateId,
    version: "0.1.0",
    pluginId: "team-orchestrator.test.workflow-dag-executor",
    pluginVersion: "0.1.0",
    name: "Executable Workflow DAG",
    description: "Exercises canonical DAG execution.",
    taskCount: 2,
    status: "loaded",
    validationErrors: [],
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: options.workflowTemplateId,
        name: "Executable Workflow DAG",
        version: "0.1.0",
        goal: "Run projected tasks.",
        tasks: [
          {
            id: "plan",
            title: "Plan",
            assignedAgentId: options.agentId,
            assignedAgentVersion: "1.0.0",
            capabilityRequirements: ["workflow.execute"],
            inputs: {
              taskBrief: "Plan the workflow."
            }
          },
          {
            id: "review",
            title: "Review",
            assignedAgentId: options.agentId,
            assignedAgentVersion: "1.0.0",
            capabilityRequirements: ["workflow.execute"],
            dependsOn: ["plan"],
            inputs: {
              taskBrief: "Review the workflow."
            }
          }
        ]
      }
    }
  });
}
