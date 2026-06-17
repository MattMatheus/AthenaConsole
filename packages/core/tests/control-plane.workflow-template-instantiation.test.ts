import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { indexLocalPluginPackage } from "../src/control-plane/plugins/index.js";
import { LocalWorkflowTemplateCatalogService } from "../src/control-plane/services/workflow-template-catalog.js";
import { loadConfig } from "../src/shared/config.js";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const bundledRoot = resolve(repoRoot, "bundled-plugins");

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
          workspaceId: "workspace-alpha",
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
          workspaceId: "workspace-alpha",
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
            channel: "stable",
            runMode: "read-only"
          },
          dependsOn: [],
          workspaceId: "workspace-alpha",
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
          workspaceId: "workspace-alpha",
          dependsOn: ["release-plan"]
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("propagates workflow run mode inputs to generated tasks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-run-mode-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedWorkflowTemplate(appState);
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("templates.release.workflow", {
          missionId: "mission-run-mode",
          taskIdPrefix: "run-mode",
          inputs: {
            releaseName: "v2.0.0",
            runMode: "propose-changes"
          }
        });

        expect(result.tasks.map((task) => task.inputs)).toEqual([
          {
            release: "v2.0.0",
            channel: "stable",
            runMode: "propose-changes"
          },
          {
            runMode: "propose-changes"
          }
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes workflow task retry policies into generated task provenance", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-retry-policy-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedRetryPolicyWorkflowTemplate(appState);
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("templates.retry.workflow", {
          missionId: "mission-retry",
          taskIdPrefix: "retry"
        });

        expect(result.tasks[0]?.provenance).toMatchObject({
          retryPolicy: {
            maxAttempts: 3,
            backoff: "exponential",
            retryableFailurePhases: ["runtime-start", "execution", "connector-rate-limit"],
            idempotency: "idempotent",
            externalWriteRetry: "require-approval"
          }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed workflow task retry policies from direct app-state seeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-bad-retry-policy-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedRetryPolicyWorkflowTemplate(appState, {
          maxAttempts: 0,
          retryableFailurePhases: []
        });
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        await expect(service.instantiate("templates.retry.workflow")).rejects.toThrow(
          "workflow.tasks.0.retryPolicy.maxAttempts must be an integer between 1 and 10"
        );
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

  it("blocks live connector workflows when credentials, scopes, or rate-limit readiness are not ready", async () => {
    const scenarios = [
      {
        name: "missing-credentials",
        expectedStatus: "missing-credentials"
      },
      {
        name: "missing-scopes",
        bindingScopes: ["fixture:read"],
        expectedStatus: "missing-scopes"
      },
      {
        name: "rate-limited",
        bindingScopes: ["fixture:read", "fixture:write"],
        connectorReadiness: { rateLimitedOperationIds: ["create-record"] },
        expectedStatus: "rate-limited"
      }
    ];

    for (const scenario of scenarios) {
      const dir = mkdtempSync(join(tmpdir(), `athena-workflow-template-live-connector-${scenario.name}-`));
      try {
        const config = loadConfig(dir);
        const appState = openAppStateDatabase(config);
        try {
          seedConnectorWorkflow(appState, {
            network: "allow",
            bindingScopes: scenario.bindingScopes,
            connectorReadiness: scenario.connectorReadiness
          });
          const service = new LocalWorkflowTemplateCatalogService(config, { appState });

          await expect(
            service.instantiate("templates.connector.workflow", {
              missionId: `mission-${scenario.name}`,
              taskIdPrefix: scenario.name
            })
          ).rejects.toMatchObject({
            code: "CONFIG_ERROR",
            details: {
              kind: "workflow-template-readiness",
              readiness: {
                checks: expect.arrayContaining([
                  expect.objectContaining({
                    id: "connector-readiness",
                    status: "blocked",
                    details: expect.objectContaining({
                      status: scenario.expectedStatus,
                      fixtureSafe: false
                    })
                  })
                ])
              }
            }
          });
          expect(appState.missions.get(`mission-${scenario.name}`)).toBeUndefined();
          expect(appState.workflowDagRuns.get(`workflow-run-mission-${scenario.name}`)).toBeUndefined();
        } finally {
          appState.close();
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("rolls back workflow DAG run and mission when generated task creation fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-rollback-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedPluginAndAgent(appState);
        seedWorkflowTemplate(appState);
        appState.tasks.create({
          id: "rollback-review",
          title: "Pre-existing review task"
        });
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        await expect(
          service.instantiate("templates.release.workflow", {
            missionId: "mission-rollback",
            taskIdPrefix: "rollback",
            inputs: {
              releaseName: "v9.9.9"
            }
          })
        ).rejects.toMatchObject({
          code: "PROVIDER_ERROR"
        });

        expect(appState.workflowDagRuns.get("workflow-run-mission-rollback")).toBeUndefined();
        expect(appState.missions.get("mission-rollback")).toBeUndefined();
        expect(appState.tasks.get("rollback-plan")).toBeUndefined();
        expect(appState.tasks.get("rollback-review")).toMatchObject({
          id: "rollback-review",
          title: "Pre-existing review task"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows fixture-safe connector workflows without live connector credentials", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-fixture-connector-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        seedConnectorWorkflow(appState, { network: "deny" });
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("templates.connector.workflow", {
          missionId: "mission-fixture-connector",
          taskIdPrefix: "fixture"
        });

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0]).toMatchObject({
          id: "fixture-use-connector",
          assignedAgentId: "connector.agent"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("instantiates bundled GitHub workflows with resolved fixture inputs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-github-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        expect(indexLocalPluginPackage(appState, resolve(bundledRoot, "software-team"), "system").status).toBe("loaded");
        expect(indexLocalPluginPackage(appState, resolve(bundledRoot, "github"), "system").status).toBe("loaded");
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("bundled.github.pr-review-brief.workflow", {
          missionId: "mission-github-pr",
          taskIdPrefix: "github-pr",
          inputs: {
            repository: "octo-org/widget",
            pullRequest: 17,
            localContext: "Local fixture context."
          }
        });

        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0]).toMatchObject({
          id: "github-pr-summarize-pr",
          assignedAgentId: "bundled.github.pr.summarize.local",
          inputs: {
            repository: "octo-org/widget",
            pullRequest: 17,
            runMode: "read-only"
          }
        });
        expect(result.tasks[1]).toMatchObject({
          id: "github-pr-review-support",
          assignedAgentId: "bundled.github.pr.review-support.local",
          dependsOn: ["github-pr-summarize-pr"],
          inputs: {
            repository: "octo-org/widget",
            pullRequest: 17,
            localContext: "Local fixture context.",
            runMode: "read-only"
          }
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("instantiates bundled Jira issue context workflow with software-team review support", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workflow-template-jira-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        expect(indexLocalPluginPackage(appState, resolve(bundledRoot, "software-team"), "system").status).toBe("loaded");
        expect(indexLocalPluginPackage(appState, resolve(bundledRoot, "jira"), "system").status).toBe("loaded");
        const service = new LocalWorkflowTemplateCatalogService(config, { appState });

        const result = await service.instantiate("bundled.jira.issue-context-review.workflow", {
          missionId: "mission-jira-issue",
          taskIdPrefix: "jira-issue",
          inputs: {
            site: "https://acme.atlassian.net",
            issueKey: "ENG-1842",
            repository: "acme/widget-service",
            focus: "Check rollout risk."
          }
        });

        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0]).toMatchObject({
          id: "jira-issue-read-jira-issue",
          assignedAgentId: "bundled.jira.issue-context.local",
          inputs: {
            site: "https://acme.atlassian.net",
            issueKey: "ENG-1842",
            repository: "acme/widget-service",
            focus: "Check rollout risk.",
            runMode: "read-only"
          }
        });
        expect(result.tasks[1]).toMatchObject({
          id: "jira-issue-review-issue-context",
          assignedAgentId: "bundled.software-team.code-review.local",
          dependsOn: ["jira-issue-read-jira-issue"],
          inputs: {
            objective: "Review implementation risk and next steps for Jira issue ENG-1842.",
            evidence: "Jira issue ENG-1842 from https://acme.atlassian.net. Repository: acme/widget-service. Focus: Check rollout risk.",
            runMode: "read-only"
          }
        });
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

function seedRetryPolicyWorkflowTemplate(
  appState: ReturnType<typeof openAppStateDatabase>,
  retryPolicy: Record<string, unknown> = buildRetryPolicy()
): void {
  appState.workflowTemplates.upsert({
    id: "templates.retry.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.templates",
    pluginVersion: "0.1.0",
    name: "Retry Workflow",
    description: "Prepare retry metadata.",
    taskCount: 1,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "templates.retry.workflow",
        name: "Retry Workflow",
        version: "0.1.0",
        goal: "Prepare retry metadata.",
        tasks: [
          {
            id: "plan",
            title: "Plan retry",
            assignedAgentId: "template.agent",
            assignedAgentVersion: "1.0.0",
            retryPolicy
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
}

function buildRetryPolicy(): Record<string, unknown> {
  return {
    maxAttempts: 3,
    backoff: "exponential",
    retryableFailurePhases: ["runtime-start", "execution", "connector-rate-limit"],
    idempotency: "idempotent",
    externalWriteRetry: "require-approval"
  };
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

function seedConnectorWorkflow(
  appState: ReturnType<typeof openAppStateDatabase>,
  options: {
    network: "allow" | "deny";
    bindingScopes?: string[];
    connectorReadiness?: Record<string, unknown>;
  }
): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.connector-workflow",
    version: "0.1.0",
    path: "/tmp/team-orchestrator-connector-workflow",
    sourceType: "local",
    status: "loaded",
    manifest: {
      schemaVersion: 1,
      plugin: {
        id: "team-orchestrator.test.connector-workflow",
        name: "Connector Workflow Plugin",
        version: "0.1.0",
        connector: {
          service: {
            id: "fixture.service",
            name: "Fixture Service"
          },
          auth: {
            type: "api-token",
            credentialBinding: "required"
          },
          scopes: [
            {
              id: "fixture:read",
              label: "Read fixture records",
              required: true,
              access: "read"
            },
            {
              id: "fixture:write",
              label: "Write fixture records",
              required: true,
              access: "write"
            }
          ],
          ...(options.connectorReadiness ? { readiness: options.connectorReadiness } : {}),
          operations: [
            {
              id: "list-records",
              class: "read",
              scopes: ["fixture:read"]
            },
            {
              id: "create-record",
              class: "external-write",
              scopes: ["fixture:write"],
              approvalRequired: true
            }
          ]
        }
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "connector.agent",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.connector-workflow",
    pluginVersion: "0.1.0",
    name: "Connector Agent",
    capabilities: ["connector.run"],
    manifest: {
      schemaVersion: 1,
      agent: {
        runtime: {
          connectorOperations: ["list-records", "create-record"]
        },
        permissions: {
          network: options.network
        }
      }
    },
    status: "loaded"
  });
  appState.workflowTemplates.upsert({
    id: "templates.connector.workflow",
    version: "0.1.0",
    pluginId: "team-orchestrator.test.connector-workflow",
    pluginVersion: "0.1.0",
    name: "Connector Workflow",
    description: "Exercise connector preflight.",
    taskCount: 1,
    manifest: {
      schemaVersion: 1,
      workflow: {
        id: "templates.connector.workflow",
        name: "Connector Workflow",
        version: "0.1.0",
        goal: "Use a connector.",
        tasks: [
          {
            id: "use-connector",
            title: "Use connector",
            assignedAgentId: "connector.agent",
            assignedAgentVersion: "1.0.0"
          }
        ]
      }
    },
    status: "loaded",
    validationErrors: []
  });
  if (options.bindingScopes) {
    appState.connectorCredentialBindings.upsert({
      pluginId: "team-orchestrator.test.connector-workflow",
      pluginVersion: "0.1.0",
      serviceId: "fixture.service",
      bindingRef: "local-file:/run/secrets/athena/fixture-token",
      scopes: options.bindingScopes,
      status: "bound",
      now: new Date("2026-06-12T00:00:00.000Z")
    });
  }
}
