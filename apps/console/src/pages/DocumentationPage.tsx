import {
  BookOpenText,
  CheckCircle2,
  Code2,
  Copy,
  FileCode2,
  FolderGit2,
  KeyRound,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Route,
} from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PageScaffold.module.css";

type DocStep = {
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
  icon: typeof BookOpenText;
};

const firstRunSteps: DocStep[] = [
  {
    title: "Connect a model provider",
    body: "Add an OpenAI-compatible provider with a base URL, model name, and secret reference. For DeepSeek, use its OpenAI-compatible API endpoint and your DeepSeek API key reference.",
    link: "/settings",
    linkLabel: "Open settings",
    icon: KeyRound,
  },
  {
    title: "Create a plugin package",
    body: "Put a plugin folder under .athena/plugins or another configured plugin path. Each plugin has one plugin.yaml plus one or more agent manifests and runner files.",
    icon: FolderGit2,
  },
  {
    title: "Define the agent manifest",
    body: "Declare the agent id, inputs, capabilities, implementation command, permissions, limits, and optional model provider requirement.",
    icon: FileCode2,
  },
  {
    title: "Restart and inspect",
    body: "Restart the API after adding plugin files, then confirm the plugin and agent appear in the catalog before creating a task.",
    link: "/agents",
    linkLabel: "Open agents",
    icon: RefreshCw,
  },
  {
    title: "Run a task",
    body: "Create a task from the agent, fill the generated input form, choose repo context or run mode when required, and inspect the run output.",
    link: "/tasks",
    linkLabel: "New task",
    icon: PlayCircle,
  },
];

const sampleReferences: DocStep[] = [
  {
    title: "Model provider smoke agent",
    body: "sample-plugins/model-provider-smoke proves DeepSeek or any OpenAI-compatible provider can be passed into a local agent and used for a real prompt.",
    icon: KeyRound,
  },
  {
    title: "Repo summary agent",
    body: "sample-plugins/repo-summary shows a read-only local agent with structured repo input, manifest validation, and markdown artifact output.",
    icon: Route,
  },
  {
    title: "Generic research agents",
    body: "sample-plugins/generic-research shows article summarization and shopping research planning agents built with @athena/pdk helpers.",
    icon: PlugZap,
  },
  {
    title: "PDK helpers",
    body: "@athena/pdk parses task envelopes, validates manifest-shaped inputs, and serializes output/artifact envelopes for local-command agents.",
    icon: Code2,
  },
];

const copyChecklist = [
  {
    label: "Plugin identity",
    detail: "Change plugin.id, plugin.name, and plugin.agents[0].id in plugin.yaml.",
  },
  {
    label: "Agent identity",
    detail: "Change agent.id and agent.name in agents/model-prompt.agent.yaml. The agent id must match plugin.yaml.",
  },
  {
    label: "Artifact namespace",
    detail: "Change memory://model-provider-smoke/... in the runner to a namespace for the copied plugin.",
  },
  {
    label: "Docs labels",
    detail: "Update docs/README.md so the catalog docs, agent name, and run instructions match the copied agent.",
  },
  {
    label: "Catalog restart",
    detail: "Restart the API, open Agents, and fix any duplicate plugin id or agent id validation messages before running tasks.",
  },
];

const copyCommands = `cp -R sample-plugins/model-provider-smoke sample-plugins/local-user-test

# Restart after editing plugin.yaml, the agent manifest, runner namespace, and docs.
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev

# Catalog checks
curl "http://127.0.0.1:8787/api/v1/agent-catalog/agents"
curl "http://127.0.0.1:8787/api/v1/agent-catalog/plugins"`;

const pluginYaml = `schemaVersion: 1
plugin:
  id: my.first.plugin
  name: My First Plugin
  version: 0.1.0
  agents:
    - path: agents/my-agent.agent.yaml
      id: my.agent.local
      version: 0.1.0
  compatibility:
    teamOrchestrator: ">=0.1.0"
    manifestSchema: team-orchestrator.manifests.v1
    runtimeBackends: [local-process]
    platforms: [any]
  permissions:
    network: deny
    filesystem: scoped
    shell: allow
    credentials: deny`;

const agentYaml = `schemaVersion: 1
agent:
  id: my.agent.local
  name: My Local Agent
  version: 0.1.0
  description: Produces a short answer from structured task input.
  capabilities:
    - text.summarize
    - artifacts.produce
  inputs:
    objective:
      type: markdown
      required: true
      label: Objective
  implementation:
    type: local-command
    command: node
    args: [agents/my-agent-runner.mjs]
  runtime:
    preferredBackend: local-process
    backendPreferences: [local-process]
    workingDirectory: .
    modelProvider:
      required: false
      providerKind: openai-compatible
      label: Optional model provider
  permissions:
    network: deny
    filesystem: scoped
    shell: allow
    credentials: deny
  limits:
    maxRuntimeSeconds: 60
    maxToolCalls: 0`;

const runner = `import {
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  objective: { type: "markdown", required: true }
};

let stdin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) stdin += chunk;

const envelope = parseAgentTaskRunEnvelope(stdin);
const inputs = parseAgentEnvelopeInputs(envelope, inputContract);

process.stdout.write(
  serializeAgentRunOutput(
    createAgentRunOutput({
      summary: \`Received objective: \${inputs.objective}\`
    })
  )
);`;

export function DocumentationPage() {
  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.key}>Documentation</p>
          <h2 className={styles.pageTitle}>Build and run your first agent</h2>
        </div>
        <div className={styles.headerActions}>
          <Link to="/settings" className={styles.secondaryCta}>
            <KeyRound size={16} /> Providers
          </Link>
          <Link to="/tasks" className={styles.primaryCta}>
            <PlayCircle size={16} /> New Task
          </Link>
        </div>
      </div>

      <p className={styles.lead}>
        Agents are loaded from local plugin packages. A user creates files on disk, restarts the API so the catalog indexes
        the plugin, then runs the agent from the console with structured inputs and explicit safety limits.
      </p>

      <section className={styles.docsBand}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Copy A Working Agent</p>
            <h3 className={styles.resourceTitle}>Turn model-provider-smoke into your own agent</h3>
          </div>
          <Copy size={18} />
        </div>
        <p className={styles.settingsMuted}>
          Start with sample-plugins/model-provider-smoke when you want a known-good OpenAI-compatible provider runner. Rename every copy-sensitive field before restarting the API.
        </p>
        <div className={styles.docsSplit}>
          <ul className={styles.docsList}>
            {copyChecklist.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
          <pre className={styles.docsCode}>{copyCommands}</pre>
        </div>
        <p className={styles.settingsMuted}>
          A copied agent should appear in Agents without duplicate-id warnings, run from Tasks, and produce an inspectable Model Response artifact on the run detail page.
        </p>
      </section>

      <section className={styles.docsBand}>
        <div>
          <p className={styles.key}>Quick Path</p>
          <h3 className={styles.resourceTitle}>From provider to task run</h3>
        </div>
        <div className={styles.docsStepGrid}>
          {firstRunSteps.map((step) => (
            <DocStepCard key={step.title} step={step} />
          ))}
        </div>
      </section>

      <section className={styles.docsSplit}>
        <div className={styles.docsBand}>
          <p className={styles.key}>Plugin File</p>
          <h3 className={styles.resourceTitle}>.athena/plugins/my-first-plugin/plugin.yaml</h3>
          <pre className={styles.docsCode}>{pluginYaml}</pre>
        </div>
        <div className={styles.docsBand}>
          <p className={styles.key}>Agent Manifest</p>
          <h3 className={styles.resourceTitle}>agents/my-agent.agent.yaml</h3>
          <pre className={styles.docsCode}>{agentYaml}</pre>
        </div>
      </section>

      <section className={styles.docsBand}>
        <p className={styles.key}>Runner</p>
        <h3 className={styles.resourceTitle}>agents/my-agent-runner.mjs</h3>
        <p className={styles.settingsMuted}>
          The runner reads a Team Orchestrator task envelope from stdin and writes a serialized agent output envelope to stdout.
        </p>
        <pre className={styles.docsCode}>{runner}</pre>
      </section>

      <section className={styles.docsSplit}>
        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Provider Notes</p>
              <h3 className={styles.resourceTitle}>DeepSeek and OpenAI-compatible APIs</h3>
            </div>
            <KeyRound size={18} />
          </div>
          <ul className={styles.docsList}>
            <li>
              <strong>Provider kind</strong>
              <span>Use openai-compatible for DeepSeek, OpenAI-compatible gateways, and local model gateways that expose the same API shape.</span>
            </li>
            <li>
              <strong>Base URL</strong>
              <span>DeepSeek documents https://api.deepseek.com as its OpenAI-compatible base URL; confirm the current model id in provider docs.</span>
            </li>
            <li>
              <strong>Secret reference</strong>
              <span>Prefer an environment variable such as DEEPSEEK_API_KEY or a local secret file. The console stores the reference, not the raw key.</span>
            </li>
          </ul>
        </div>

        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Validate</p>
              <h3 className={styles.resourceTitle}>Before handing it to a user</h3>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <ul className={styles.docsList}>
            <li>
              <strong>Manifest validation</strong>
              <span>Run npm --workspace @athena/core run validate:manifests.</span>
            </li>
            <li>
              <strong>Catalog check</strong>
              <span>Open Agents and confirm the plugin status is loaded with no validation errors.</span>
            </li>
            <li>
              <strong>Task smoke</strong>
              <span>Create a small task, run it, and inspect the run result before adding broader permissions.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.docsBand}>
        <div>
          <p className={styles.key}>Examples To Copy</p>
          <h3 className={styles.resourceTitle}>Start from working samples</h3>
        </div>
        <div className={styles.docsReferenceGrid}>
          {sampleReferences.map((step) => (
            <DocStepCard key={step.title} step={step} />
          ))}
        </div>
      </section>
    </section>
  );
}

function DocStepCard({ step }: { step: DocStep }) {
  const Icon = step.icon;
  return (
    <article className={styles.docsStepCard}>
      <div className={styles.stepIcon}>
        <Icon size={18} />
      </div>
      <div>
        <h4>{step.title}</h4>
        <p>{step.body}</p>
        {step.link && step.linkLabel ? (
          <Link to={step.link} className={styles.inlineAction}>
            {step.linkLabel}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
