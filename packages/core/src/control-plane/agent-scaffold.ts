import { existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { loadYamlManifest, validatePluginPackage } from "./manifests/index.js";
import { discoverLocalPluginRoots } from "./plugins/local-loader.js";

export interface AgentScaffoldInput {
  workspaceRoot: string;
  name: string;
  pluginsDir?: string;
  pluginId?: string;
  agentId?: string;
  description?: string;
}

export interface AgentScaffoldResult {
  status: "ok";
  action: "agent.scaffold";
  pluginId: string;
  agentId: string;
  pluginRoot: string;
  validation: {
    ok: boolean;
    issueCount: number;
  };
  files: string[];
}

interface ExistingIdentities {
  pluginIds: Set<string>;
  agentIds: Set<string>;
}

interface PluginDocument {
  plugin?: {
    id?: string;
    agents?: Array<string | { path?: string; id?: string }>;
  };
}

interface AgentDocument {
  agent?: {
    id?: string;
  };
}

const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export async function scaffoldAgentPlugin(input: AgentScaffoldInput): Promise<AgentScaffoldResult> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Agent scaffold requires a non-empty --name.");
  }

  const workspaceRoot = resolve(input.workspaceRoot);
  const pluginsRoot = resolve(workspaceRoot, input.pluginsDir ?? ".athena/plugins");
  const existing = collectExistingIdentities(pluginsRoot);
  const slug = slugify(name);
  const pluginId = input.pluginId
    ? validateExplicitId(input.pluginId, "plugin id", existing.pluginIds)
    : allocateNamespacedId(`local.${slug}`, existing.pluginIds);
  const agentId = input.agentId
    ? validateExplicitId(input.agentId, "agent id", existing.agentIds)
    : allocateNamespacedId(`${pluginId}.agent`, existing.agentIds);
  const pluginDirName = allocateDirectoryName(pluginsRoot, slug);
  const pluginRoot = resolve(pluginsRoot, pluginDirName);
  const runnerNamespace = pluginId.replace(/\./g, "-");
  const description = input.description?.trim() || `Local plugin-backed agent scaffold for ${name}.`;

  const files = {
    plugin: resolve(pluginRoot, "plugin.yaml"),
    agent: resolve(pluginRoot, "agents", "scaffold.agent.yaml"),
    runner: resolve(pluginRoot, "agents", "scaffold-runner.mjs"),
    readme: resolve(pluginRoot, "docs", "README.md")
  };
  const existingTargets = Object.values(files).filter((path) => existsSync(path));
  if (existingTargets.length > 0) {
    throw new Error(`Refusing to overwrite existing agent scaffold files: ${existingTargets.join(", ")}`);
  }

  await mkdir(resolve(pluginRoot, "agents"), { recursive: true });
  await mkdir(resolve(pluginRoot, "docs"), { recursive: true });

  await Promise.all([
    writeFile(files.plugin, buildPluginManifest({ name, pluginId, agentId, description }), "utf8"),
    writeFile(files.agent, buildAgentManifest({ name, agentId, description }), "utf8"),
    writeFile(files.runner, buildRunner({ runnerNamespace }), "utf8"),
    writeFile(files.readme, buildReadme({ name, pluginId, agentId }), "utf8")
  ]);

  const validation = validatePluginPackage(pluginRoot);
  if (!validation.ok) {
    throw new Error(
      `Generated plugin did not pass manifest validation: ${validation.issues
        .map((issue) => `${issue.file ?? "manifest"} ${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }

  return {
    status: "ok",
    action: "agent.scaffold",
    pluginId,
    agentId,
    pluginRoot,
    validation: {
      ok: validation.ok,
      issueCount: validation.issues.length
    },
    files: Object.values(files)
  };
}

function collectExistingIdentities(pluginsRoot: string): ExistingIdentities {
  const pluginIds = new Set<string>();
  const agentIds = new Set<string>();
  for (const pluginRoot of discoverLocalPluginRoots(pluginsRoot)) {
    const pluginManifestPath = resolve(pluginRoot, "plugin.yaml");
    const pluginDocument = loadManifestIfPossible<PluginDocument>(pluginManifestPath);
    if (pluginDocument?.plugin?.id) {
      pluginIds.add(pluginDocument.plugin.id);
    }
    for (const reference of pluginDocument?.plugin?.agents ?? []) {
      if (typeof reference !== "string" && reference.id) {
        agentIds.add(reference.id);
      }
      const referencePath = typeof reference === "string" ? reference : reference.path;
      if (!referencePath) {
        continue;
      }
      const agentDocument = loadManifestIfPossible<AgentDocument>(resolve(pluginRoot, referencePath));
      if (agentDocument?.agent?.id) {
        agentIds.add(agentDocument.agent.id);
      }
    }
  }
  return { pluginIds, agentIds };
}

function loadManifestIfPossible<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  try {
    return loadYamlManifest(filePath) as T;
  } catch {
    return undefined;
  }
}

function validateExplicitId(value: string, label: string, existingIds: Set<string>): string {
  const normalized = value.trim();
  if (!NAMESPACED_ID_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${label} '${value}'. Expected a namespaced id such as local.my-agent.`);
  }
  if (existingIds.has(normalized)) {
    throw new Error(`Duplicate ${label} '${normalized}' already exists in the target plugins directory.`);
  }
  return normalized;
}

function allocateNamespacedId(base: string, existingIds: Set<string>): string {
  if (!NAMESPACED_ID_PATTERN.test(base)) {
    throw new Error(`Unable to derive valid namespaced id from '${base}'.`);
  }
  if (!existingIds.has(base)) {
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to allocate unique id for '${base}'.`);
}

function allocateDirectoryName(root: string, base: string): string {
  if (!existsSync(resolve(root, base))) {
    return base;
  }
  const existingNames = new Set(readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to allocate unique plugin directory for '${base}'.`);
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return /^[a-z]/.test(slug) ? slug : `agent-${slug || "new"}`;
}

function buildPluginManifest(input: { name: string; pluginId: string; agentId: string; description: string }): string {
  return [
    "schemaVersion: 1",
    "plugin:",
    `  id: ${input.pluginId}`,
    `  name: ${yamlString(input.name)}`,
    "  version: 0.1.0",
    `  description: ${yamlString(input.description)}`,
    "  authors:",
    "    - name: Local Operator",
    "  agents:",
    "    - path: agents/scaffold.agent.yaml",
    `      id: ${input.agentId}`,
    "      version: 0.1.0",
    "  docs:",
    "    readme: docs/README.md",
    "  compatibility:",
    "    teamOrchestrator: \">=0.1.0\"",
    "    manifestSchema: team-orchestrator.manifests.v1",
    "    runtimeBackends:",
    "      - local-process",
    "    platforms:",
    "      - any",
    "  permissions:",
    "    network: deny",
    "    filesystem: none",
    "    shell: allow",
    "    credentials: deny",
    "  ui:",
    "    icon: terminal-square",
    "    color: \"#3b7c6e\"",
    "    tags:",
    "      - local",
    "      - scaffolded",
    ""
  ].join("\n");
}

function buildAgentManifest(input: { name: string; agentId: string; description: string }): string {
  return [
    "schemaVersion: 1",
    "agent:",
    `  id: ${input.agentId}`,
    `  name: ${yamlString(input.name)}`,
    "  version: 0.1.0",
    `  description: ${yamlString(input.description)}`,
    "  capabilities:",
    "    - text.transform",
    "    - artifacts.produce",
    "  inputs:",
    "    prompt:",
    "      type: markdown",
    "      required: true",
    "      label: Prompt",
    "      description: Text for the scaffolded local agent to echo into an artifact.",
    "      ui:",
    "        widget: markdown",
    "        placeholder: Ask the agent to prepare a short note.",
    "  outputs:",
    "    mode: flexible",
    "    artifacts:",
    "      - key: response",
    "        label: Response",
    "        kind: primary",
    "        format: markdown",
    "  implementation:",
    "    type: local-command",
    "    command: node",
    "    args:",
    "      - agents/scaffold-runner.mjs",
    "  runtime:",
    "    preferredBackend: local-process",
    "    backendPreferences:",
    "      - local-process",
    "    workingDirectory: .",
    "  permissions:",
    "    network: deny",
    "    filesystem: none",
    "    shell: allow",
    "    credentials: deny",
    "  limits:",
    "    maxRuntimeSeconds: 30",
    "    maxToolCalls: 0",
    "    maxRepeatedActions: 1",
    "    maxRetries: 0",
    "    maxFollowUpTasks: 0",
    "    maxOutputBytes: 32768",
    "    maxArtifacts: 1",
    "  observability:",
    "    mode: inspectable",
    "    eventHints:",
    "      - run.started",
    "      - artifact.created",
    "      - run.completed",
    "  compatibility:",
    "    teamOrchestrator: \">=0.1.0\"",
    "    pluginApi: team-orchestrator.manifests.v1",
    ""
  ].join("\n");
}

function buildRunner(input: { runnerNamespace: string }): string {
  return [
    "import {",
    "  createAgentArtifact,",
    "  createAgentRunOutput,",
    "  parseAgentEnvelopeInputs,",
    "  parseAgentTaskRunEnvelope,",
    "  serializeAgentRunOutput",
    "} from \"@athena/pdk\";",
    "",
    "const inputContract = {",
    "  prompt: {",
    "    type: \"markdown\",",
    "    required: true",
    "  }",
    "};",
    "",
    "try {",
    "  const envelope = parseAgentTaskRunEnvelope(await readStdin());",
    "  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);",
    "  const responseMarkdown = renderResponse(envelope, inputs.prompt);",
    "  const artifact = createAgentArtifact({",
    "    id: `response-${envelope.run.id}`,",
    "    label: \"Response\",",
    "    kind: \"primary\",",
    "    format: \"markdown\",",
    `    storageUri: \`memory://${input.runnerNamespace}/\${encodeURIComponent(envelope.run.id)}/response.md\`,`,
    "    metadata: {",
    "      generatedBy: envelope.agent.id,",
    "      deterministic: true",
    "    }",
    "  });",
    "",
    "  process.stdout.write(",
    "    serializeAgentRunOutput(",
    "      createAgentRunOutput(",
    "        {",
    "          prompt: inputs.prompt,",
    "          responseMarkdown",
    "        },",
    "        {",
    "          artifacts: [artifact]",
    "        }",
    "      )",
    "    )",
    "  );",
    "} catch (error) {",
    "  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\\n`);",
    "  process.exitCode = 1;",
    "}",
    "",
    "async function readStdin() {",
    "  let body = \"\";",
    "  process.stdin.setEncoding(\"utf8\");",
    "  for await (const chunk of process.stdin) {",
    "    body += chunk;",
    "  }",
    "  return body;",
    "}",
    "",
    "function renderResponse(envelope, prompt) {",
    "  return [",
    "    \"# Scaffolded Agent Response\",",
    "    \"\",",
    "    `Agent: ${envelope.agent.id}`,",
    "    `Run: ${envelope.run.id}`,",
    "    \"\",",
    "    \"## Prompt\",",
    "    \"\",",
    "    String(prompt)",
    "  ].join(\"\\n\");",
    "}",
    ""
  ].join("\n");
}

function buildReadme(input: { name: string; pluginId: string; agentId: string }): string {
  return [
    `# ${input.name}`,
    "",
    "Local Team Orchestrator plugin generated by `athena agent scaffold`.",
    "",
    `- Plugin id: \`${input.pluginId}\``,
    `- Agent id: \`${input.agentId}\``,
    "- Runtime backend: `local-process`",
    "- Network: denied",
    "",
    "## Use It",
    "",
    "1. Restart the API after creating or editing this plugin.",
    "2. Open the console Agents page and confirm this agent is visible.",
    "3. Open Tasks, choose this agent, enter a prompt, and run the task.",
    "4. Inspect the task run output and the `Response` artifact metadata.",
    "",
    "The scaffold command validates this plugin before it exits. Re-run the command with a different `--name`, `--plugin-id`, or `--agent-id` if you need another generated agent.",
    "",
    "## Files",
    "",
    "- `plugin.yaml` declares the plugin package.",
    "- `agents/scaffold.agent.yaml` declares the task-facing agent contract.",
    "- `agents/scaffold-runner.mjs` implements deterministic local behavior with `@athena/pdk` helpers.",
    ""
  ].join("\n");
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function relativeToWorkspace(workspaceRoot: string, path: string): string {
  const rel = relative(resolve(workspaceRoot), resolve(path));
  return rel && !rel.startsWith("..") ? rel : basename(path);
}
