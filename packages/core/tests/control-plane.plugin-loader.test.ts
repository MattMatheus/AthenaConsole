import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { indexConfiguredLocalPlugins } from "../src/control-plane/plugins/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("local plugin loader and indexer", () => {
  it("indexes a valid local plugin and referenced agent", () => {
    const dir = mkdtemp("athena-plugin-valid-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=plugins\n", "utf8");
      writePluginPackage(join(dir, "plugins", "news"), {
        pluginId: "team-orchestrator.test.news",
        agentId: "news.digest.test",
        workflowTemplateId: "news.digest.workflow"
      });

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const result = indexConfiguredLocalPlugins(config, { appState });

        expect(result.plugins).toHaveLength(1);
        expect(result.plugins[0]).toMatchObject({
          id: "team-orchestrator.test.news",
          version: "0.1.0",
          status: "loaded",
          enabled: true,
          sourceType: "local"
        });
        expect(result.plugins[0]?.agents.map((agent) => agent.id)).toEqual(["news.digest.test"]);
        expect(result.plugins[0]?.workflowTemplates.map((template) => template.id)).toEqual(["news.digest.workflow"]);

        const plugins = appState.plugins.list();
        const agents = appState.agents.list();
        const workflowTemplates = appState.workflowTemplates.list();
        expect(plugins).toHaveLength(1);
        expect(plugins[0]?.validationErrors).toEqual([]);
        expect(agents).toHaveLength(1);
        expect(agents[0]).toMatchObject({
          id: "news.digest.test",
          version: "0.1.0",
          pluginId: "team-orchestrator.test.news",
          pluginVersion: "0.1.0",
          name: "Test Agent",
          capabilities: ["test.run"]
        });
        expect(workflowTemplates).toHaveLength(1);
        expect(workflowTemplates[0]).toMatchObject({
          id: "news.digest.workflow",
          version: "0.1.0",
          pluginId: "team-orchestrator.test.news",
          pluginVersion: "0.1.0",
          name: "Test Workflow",
          description: "A repeatable test workflow.",
          taskCount: 2,
          status: "loaded"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("captures validation errors and avoids indexing agents for invalid plugins", () => {
    const dir = mkdtemp("athena-plugin-invalid-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=plugins\n", "utf8");
      mkdirSync(join(dir, "plugins", "broken"), { recursive: true });
      writeFileSync(
        join(dir, "plugins", "broken", "plugin.yaml"),
        [
          "schemaVersion: 1",
          "plugin:",
          "  id: team-orchestrator.test.broken",
          "  name: Broken Plugin",
          "  version: 0.1.0",
          "  agents:",
          "    - path: agents/missing.agent.yaml",
          "      id: missing.agent",
          "      version: 0.1.0",
          ""
        ].join("\n"),
        "utf8"
      );

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const result = indexConfiguredLocalPlugins(config, { appState });

        expect(result.plugins).toHaveLength(1);
        expect(result.plugins[0]?.status).toBe("invalid");
        expect(result.plugins[0]?.validationErrors.length).toBeGreaterThan(0);
        expect(appState.plugins.list()[0]).toMatchObject({
          id: "team-orchestrator.test.broken",
          status: "invalid"
        });
        expect(appState.agents.list()).toEqual([]);
        expect(appState.workflowTemplates.list()).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads only first-class resources explicitly referenced from plugin.yaml", () => {
    const dir = mkdtemp("athena-plugin-explicit-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=plugins\n", "utf8");
      const pluginRoot = join(dir, "plugins", "explicit");
      writePluginPackage(pluginRoot, {
        pluginId: "team-orchestrator.test.explicit",
        agentId: "explicit.referenced"
      });
      writeAgentManifest(join(pluginRoot, "agents", "unreferenced.agent.yaml"), {
        id: "explicit.unreferenced",
        name: "Unreferenced Agent"
      });
      mkdirSync(join(pluginRoot, "workflows"), { recursive: true });
      writeWorkflowTemplate(join(pluginRoot, "workflows", "unreferenced.workflow.yaml"), {
        id: "explicit.unreferenced.workflow",
        name: "Unreferenced Workflow"
      });

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        indexConfiguredLocalPlugins(config, { appState });

        expect(appState.agents.list().map((agent) => agent.id)).toEqual(["explicit.referenced"]);
        expect(appState.workflowTemplates.list()).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves plugin enablement per workspace across reindexing", () => {
    const dir = mkdtemp("athena-plugin-enable-");
    try {
      const sharedPluginRoot = join(dir, "shared-plugins", "software");
      writePluginPackage(sharedPluginRoot, {
        pluginId: "team-orchestrator.test.software",
        agentId: "software.task.test"
      });
      const workspaceA = join(dir, "workspace-a");
      const workspaceB = join(dir, "workspace-b");
      mkdirSync(workspaceA, { recursive: true });
      mkdirSync(workspaceB, { recursive: true });
      writeFileSync(join(workspaceA, ".env"), `ATHENA_PLUGIN_PATHS=${resolve(dir, "shared-plugins")}\n`, "utf8");
      writeFileSync(join(workspaceB, ".env"), `ATHENA_PLUGIN_PATHS=${resolve(dir, "shared-plugins")}\n`, "utf8");

      const configA = loadConfig(workspaceA);
      const configB = loadConfig(workspaceB);
      const appStateA = openAppStateDatabase(configA);
      const appStateB = openAppStateDatabase(configB);
      try {
        indexConfiguredLocalPlugins(configA, { appState: appStateA });
        indexConfiguredLocalPlugins(configB, { appState: appStateB });

        expect(appStateA.plugins.setEnabled("team-orchestrator.test.software", "0.1.0", false)).toBe(true);
        indexConfiguredLocalPlugins(configA, { appState: appStateA });
        indexConfiguredLocalPlugins(configB, { appState: appStateB });

        expect(appStateA.plugins.get("team-orchestrator.test.software", "0.1.0")?.enabled).toBe(false);
        expect(appStateB.plugins.get("team-orchestrator.test.software", "0.1.0")?.enabled).toBe(true);
      } finally {
        appStateA.close();
        appStateB.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("indexes configured system plugins with the system source type", () => {
    const dir = mkdtemp("athena-plugin-system-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=\nATHENA_SYSTEM_PLUGIN_PATHS=system-plugins\n", "utf8");
      writePluginPackage(join(dir, "system-plugins", "base"), {
        pluginId: "team-orchestrator.system.base",
        agentId: "system.base-agent"
      });

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        indexConfiguredLocalPlugins(config, { appState });

        expect(appState.plugins.list()).toHaveLength(1);
        expect(appState.plugins.list()[0]).toMatchObject({
          id: "team-orchestrator.system.base",
          sourceType: "system",
          status: "loaded"
        });
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("captures workflow template validation errors and avoids indexing templates for invalid plugins", () => {
    const dir = mkdtemp("athena-plugin-invalid-workflow-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=plugins\n", "utf8");
      const pluginRoot = join(dir, "plugins", "broken-workflow");
      mkdirSync(join(pluginRoot, "agents"), { recursive: true });
      mkdirSync(join(pluginRoot, "workflows"), { recursive: true });
      writeFileSync(
        join(pluginRoot, "plugin.yaml"),
        [
          "schemaVersion: 1",
          "plugin:",
          "  id: team-orchestrator.test.broken-workflow",
          "  name: Broken Workflow Plugin",
          "  version: 0.1.0",
          "  agents:",
          "    - path: agents/test.agent.yaml",
          "      id: broken.workflow.agent",
          "      version: 0.1.0",
          "  workflowTemplates:",
          "    - path: workflows/broken.workflow.yaml",
          "      id: broken.workflow.template",
          "      version: 0.1.0",
          ""
        ].join("\n"),
        "utf8"
      );
      writeAgentManifest(join(pluginRoot, "agents", "test.agent.yaml"), {
        id: "broken.workflow.agent",
        name: "Broken Workflow Agent"
      });
      writeFileSync(
        join(pluginRoot, "workflows", "broken.workflow.yaml"),
        [
          "schemaVersion: 1",
          "workflow:",
          "  id: broken.workflow.template",
          "  name: Broken Workflow",
          "  version: 0.1.0",
          "  tasks: []",
          ""
        ].join("\n"),
        "utf8"
      );

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const result = indexConfiguredLocalPlugins(config, { appState });

        expect(result.plugins).toHaveLength(1);
        expect(result.plugins[0]?.status).toBe("invalid");
        expect(result.plugins[0]?.validationErrors.some((issue) => issue.file?.endsWith("broken.workflow.yaml"))).toBe(true);
        expect(appState.agents.list()).toEqual([]);
        expect(appState.workflowTemplates.list()).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("captures workflow DAG validation errors during plugin indexing", () => {
    const dir = mkdtemp("athena-plugin-invalid-workflow-dag-");
    try {
      writeFileSync(join(dir, ".env"), "ATHENA_PLUGIN_PATHS=plugins\n", "utf8");
      const pluginRoot = join(dir, "plugins", "broken-workflow-dag");
      mkdirSync(join(pluginRoot, "agents"), { recursive: true });
      mkdirSync(join(pluginRoot, "workflows"), { recursive: true });
      writeFileSync(
        join(pluginRoot, "plugin.yaml"),
        [
          "schemaVersion: 1",
          "plugin:",
          "  id: team-orchestrator.test.broken-workflow-dag",
          "  name: Broken Workflow DAG Plugin",
          "  version: 0.1.0",
          "  agents:",
          "    - path: agents/test.agent.yaml",
          "      id: broken.workflow.dag.agent",
          "      version: 0.1.0",
          "  workflowTemplates:",
          "    - path: workflows/broken.workflow.yaml",
          "      id: broken.workflow.dag.template",
          "      version: 0.1.0",
          ""
        ].join("\n"),
        "utf8"
      );
      writeAgentManifest(join(pluginRoot, "agents", "test.agent.yaml"), {
        id: "broken.workflow.dag.agent",
        name: "Broken Workflow DAG Agent"
      });
      writeFileSync(
        join(pluginRoot, "workflows", "broken.workflow.yaml"),
        [
          "schemaVersion: 1",
          "workflow:",
          "  id: broken.workflow.dag.template",
          "  name: Broken Workflow DAG",
          "  version: 0.1.0",
          "  goal: Demonstrate invalid dependencies.",
          "  tasks:",
          "    - id: review",
          "      title: Review",
          "      dependsOn:",
          "        - plan",
          ""
        ].join("\n"),
        "utf8"
      );

      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        const result = indexConfiguredLocalPlugins(config, { appState });

        expect(result.plugins[0]?.status).toBe("invalid");
        expect(result.plugins[0]?.validationErrors).toEqual([
          expect.objectContaining({
            file: expect.stringContaining("broken.workflow.yaml"),
            message: "Workflow task 'review' depends on missing task 'plan'."
          })
        ]);
        expect(appState.workflowTemplates.list()).toEqual([]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function mkdtemp(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writePluginPackage(
  pluginRoot: string,
  options: { pluginId: string; agentId: string; workflowTemplateId?: string }
): void {
  mkdirSync(join(pluginRoot, "agents"), { recursive: true });
  if (options.workflowTemplateId) {
    mkdirSync(join(pluginRoot, "workflows"), { recursive: true });
  }
  writeFileSync(
    join(pluginRoot, "plugin.yaml"),
    [
      "schemaVersion: 1",
      "plugin:",
      `  id: ${options.pluginId}`,
      "  name: Test Plugin",
      "  version: 0.1.0",
      "  agents:",
      "    - path: agents/test.agent.yaml",
      `      id: ${options.agentId}`,
      "      version: 0.1.0",
      ...(options.workflowTemplateId
        ? [
            "  workflowTemplates:",
            "    - path: workflows/test.workflow.yaml",
            `      id: ${options.workflowTemplateId}`,
            "      version: 0.1.0"
          ]
        : []),
      "  compatibility:",
      "    manifestSchema: team-orchestrator.manifests.v1",
      "  permissions:",
      "    network: deny",
      "    filesystem: scoped",
      ""
    ].join("\n"),
    "utf8"
  );
  writeAgentManifest(join(pluginRoot, "agents", "test.agent.yaml"), {
    id: options.agentId,
    name: "Test Agent"
  });
  if (options.workflowTemplateId) {
    writeWorkflowTemplate(join(pluginRoot, "workflows", "test.workflow.yaml"), {
      id: options.workflowTemplateId,
      name: "Test Workflow"
    });
  }
}

function writeAgentManifest(filePath: string, options: { id: string; name: string }): void {
  writeFileSync(
    filePath,
    [
      "schemaVersion: 1",
      "agent:",
      `  id: ${options.id}`,
      `  name: ${options.name}`,
      "  version: 0.1.0",
      "  capabilities:",
      "    - test.run",
      "  inputs:",
      "    task:",
      "      type: string",
      "      required: true",
      "  outputs:",
      "    mode: flexible",
      "  implementation:",
      "    type: local-command",
      "    command: node",
      "  permissions:",
      "    network: deny",
      "    filesystem: scoped",
      "  limits:",
      "    maxRuntimeSeconds: 60",
      "    maxToolCalls: 1",
      "  observability:",
      "    mode: black-box",
      ""
    ].join("\n"),
    "utf8"
  );
}

function writeWorkflowTemplate(filePath: string, options: { id: string; name: string }): void {
  writeFileSync(
    filePath,
    [
      "schemaVersion: 1",
      "workflow:",
      `  id: ${options.id}`,
      `  name: ${options.name}`,
      "  version: 0.1.0",
      "  description: A repeatable test workflow.",
      "  goal: Coordinate test work from planning to summary.",
      "  context:",
      "    source: test",
      "  tasks:",
      "    - id: plan",
      "      title: Plan",
      "      capabilityRequirements:",
      "        - test.run",
      "      inputs:",
      "        brief: Plan the test work.",
      "    - id: summarize",
      "      title: Summarize",
      "      capabilityRequirements:",
      "        - test.run",
      "      dependsOn:",
      "        - plan",
      "  ui:",
      "    icon: list-checks",
      "    color: \"#2f855a\"",
      ""
    ].join("\n"),
    "utf8"
  );
}
