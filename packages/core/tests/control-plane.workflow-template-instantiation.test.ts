import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalWorkflowTemplateCatalogService } from "../src/control-plane/services/workflow-template-catalog.js";
import { loadConfig } from "../src/shared/config.js";

describe("workflow template instantiation service", () => {
  it("instantiates a workflow template into a mission and ordered tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-instantiate-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedWorkflowTemplate(appState);
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("templates.release.workflow", {
          missionId: "mission-release",
          taskIdPrefix: "release",
          inputs: {
            releaseName: "v1.2.0"
          },
          createdBy: "operator"
        });

        expect(result.mission).toMatchObject({
          id: "mission-release",
          title: "Release Workflow",
          goal: "Prepare release v1.2.0.",
          status: "ready",
          taskOrder: ["release-plan", "release-review"],
          context: {
            template: {
              id: "templates.release.workflow",
              version: "0.1.0",
              pluginId: "team-orchestrator.test.templates"
            },
            inputs: {
              releaseName: "v1.2.0",
              channel: "stable"
            },
            value: {
              release: "v1.2.0",
              channel: "stable"
            }
          }
        });
        expect(result.workflowDagRun).toEqual({ id: "workflow-run-mission-release" });
        expect(appState.workflowDagRuns.requireSnapshot(result.workflowDagRun.id).run).toMatchObject({
          id: "workflow-run-mission-release",
          workflowTemplateId: "templates.release.workflow",
          workflowTemplateVersion: "0.1.0",
          pluginId: "team-orchestrator.test.templates",
          pluginVersion: "0.1.0",
          status: "pending",
          stepOrder: ["plan", "review"]
        });
        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0]).toMatchObject({
          id: "release-plan",
          title: "Plan v1.2.0",
          status: "ready",
          assignedAgentId: "template.agent",
          capabilityRequirements: ["release.plan"],
          inputs: {
            release: "v1.2.0",
            channel: "stable"
          },
          dependsOn: [],
          missionId: "mission-release",
          provenance: {
            source: "workflow-template",
            workflowTemplateId: "templates.release.workflow",
            templateTaskId: "plan",
            workflowDagRunId: "workflow-run-mission-release",
            workflowDagStepId: "plan"
          },
          createdBy: "operator"
        });
        expect(result.tasks[1]).toMatchObject({
          id: "release-review",
          dependsOn: ["release-plan"]
        });
        expect(appState.missions.require("mission-release")).toMatchObject({ taskOrder: ["release-plan", "release-review"] });
        expect(appState.tasks.require("release-review")).toMatchObject({
          missionId: "mission-release",
          dependsOn: ["release-plan"]
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing templates and missing required inputs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-instantiate-errors-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedWorkflowTemplate(appState);
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        await expect(service.instantiate("templates.missing.workflow")).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
        await expect(service.instantiate("templates.release.workflow")).rejects.toThrow(
          "workflowTemplates.instantiate.inputs.releaseName is required"
        );
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("instantiates workflow templates in topological order when dependencies are explicit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-instantiate-dag-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedDagWorkflowTemplate(appState);
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("templates.dag.workflow", {
          missionId: "mission-dag",
          taskIdPrefix: "dag"
        });

        expect(result.mission.taskOrder).toEqual(["dag-plan", "dag-test", "dag-build", "dag-deploy"]);
        expect(appState.workflowDagRuns.requireSnapshot(result.workflowDagRun.id).steps.map((step) => step.stepId)).toEqual([
          "plan",
          "test",
          "build",
          "deploy"
        ]);
        expect(result.tasks.map((task) => task.id)).toEqual(["dag-plan", "dag-test", "dag-build", "dag-deploy"]);
        expect(result.tasks.map((task) => ({ id: task.id, dependsOn: task.dependsOn }))).toEqual([
          { id: "dag-plan", dependsOn: [] },
          { id: "dag-test", dependsOn: ["dag-plan"] },
          { id: "dag-build", dependsOn: ["dag-plan", "dag-test"] },
          { id: "dag-deploy", dependsOn: ["dag-build"] }
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedPluginAndAgent(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.templates",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-template-plugin",
    sourceType: "local",
    status: "loaded",
    manifest: {
      schemaVersion: 1,
      plugin: {
        id: "team-orchestrator.test.templates",
        name: "Template Plugin",
        version: "0.1.0"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "template.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.templates",
    pluginVersion: "0.1.0",
    name: "Template Agent",
    capabilities: ["release.plan", "release.review"],
    manifest: {},
    status: "loaded"
  });
}

function seedWorkflowTemplate(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.workflowTemplates.upsert({
    id: "templates.release.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.templates",
    pluginVersion: "0.1.0",
    name: "Release Workflow",
    description: "Prepare a release.",
    taskCount: 2,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "templates.release.workflow",
        name: "Release Workflow",
        version: "0.1.0",
        goal: "Prepare release {{releaseName}}.",
        inputs: {
          releaseName: { required: true },
          channel: { default: "stable" }
        },
        context: {
          release: "{{releaseName}}",
          channel: "{{channel}}"
        },
        tasks: [
          {
            id: "plan",
            title: "Plan {{releaseName}}",
            capabilityRequirements: ["release.plan"],
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0",
            inputs: {
              release: "{{releaseName}}",
              channel: "{{channel}}"
            }
          },
          {
            id: "review",
            title: "Review {{releaseName}}",
            capabilityRequirements: ["release.review"],
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0",
            dependsOn: ["plan"]
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}

function seedDagWorkflowTemplate(appState: ReturnType<typeof openAppStateDatabase>): void {
  appState.workflowTemplates.upsert({
    id: "templates.dag.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.templates",
    pluginVersion: "0.1.0",
    name: "DAG Workflow",
    description: "Exercise dependency ordering.",
    taskCount: 4,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "templates.dag.workflow",
        name: "DAG Workflow",
        version: "0.1.0",
        goal: "Run a DAG.",
        tasks: [
          {
            id: "deploy",
            title: "Deploy",
            dependsOn: ["build"],
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0"
          },
          {
            id: "plan",
            title: "Plan",
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0"
          },
          {
            id: "test",
            title: "Test",
            dependsOn: ["plan"],
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0"
          },
          {
            id: "build",
            title: "Build",
            dependsOn: ["plan", "test"],
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0"
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}
