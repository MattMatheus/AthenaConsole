import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  Code2,
  Database,
  FileCode2,
  FolderGit2,
  GitBranch,
  KeyRound,
  ListChecks,
  PackageOpen,
  PlayCircle,
  PlugZap,
  Route,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./PageScaffold.module.css";

type GuideCard = {
  title: string;
  body: string;
  icon: typeof BookOpenText;
  link?: string;
  linkLabel?: string;
};

type GuideStep = {
  label: string;
  detail: string;
};

const conceptCards: GuideCard[] = [
  {
    title: "Plugins",
    body: "Local packages that provide agents, workflow templates, schemas, docs, fixtures, and tests. A plugin.yaml file tells Team Orchestrator what is inside.",
    icon: PackageOpen,
  },
  {
    title: "Agents",
    body: "Formal executable units with manifests. Agents declare inputs, outputs, runtime, permissions, limits, and provider requirements.",
    icon: PlugZap,
    link: "/agents",
    linkLabel: "Open agents",
  },
  {
    title: "Tasks",
    body: "One unit of work assigned to one compatible agent. Running a task creates inspectable task-run history.",
    icon: ListChecks,
    link: "/tasks",
    linkLabel: "Create task",
  },
  {
    title: "Missions",
    body: "Groups of related tasks under a shared goal. Use them when work has multiple steps or agents.",
    icon: Route,
    link: "/missions",
    linkLabel: "Open missions",
  },
  {
    title: "Workflow templates",
    body: "Repeatable plans supplied by plugins. They can instantiate missions and dependency-aware workflow runs.",
    icon: Workflow,
    link: "/workflows",
    linkLabel: "Open workflows",
  },
  {
    title: "Runs",
    body: "Execution records that explain status, backend, events, outputs, artifacts, and why work stopped.",
    icon: PlayCircle,
  },
  {
    title: "Artifacts",
    body: "Inspectable outputs such as model responses, markdown reports, evidence, transcripts, or proposed changes.",
    icon: ScrollText,
  },
  {
    title: "Safety controls",
    body: "Manifest permissions, runtime policy packs, limits, approvals, read-only modes, and proposed-change artifacts keep work bounded.",
    icon: ShieldCheck,
  },
];

const firstRunSteps: GuideStep[] = [
  {
    label: "Start the local stack",
    detail: "Run the local compose profile, then open the console at http://127.0.0.1:5173.",
  },
  {
    label: "Check readiness",
    detail: "Use the dashboard or /api/v1/readiness. Degraded optional provider checks do not block the credential-free demo.",
  },
  {
    label: "Run the demo workflow",
    detail: "Open Workflows and instantiate first-run.demo.workflow from the checked-in sample plugin.",
  },
  {
    label: "Inspect the result",
    detail: "Open the workflow run graph, confirm prepare and verify completed, then follow task-run artifact metadata.",
  },
];

const realWorkSteps: GuideStep[] = [
  {
    label: "Choose a target repo",
    detail: "Use a connected repository, a managed clone, or an explicitly mounted local path for compose-based runs.",
  },
  {
    label: "Load useful agents",
    detail: "Confirm plugin-backed agents appear in Agents before starting work. Fix catalog validation warnings first.",
  },
  {
    label: "Configure providers when needed",
    detail: "Model-backed agents require provider records and secret references. Local demo agents do not.",
  },
  {
    label: "Start small",
    detail: "Run one read-only or proposed-change task, inspect artifacts, then widen permissions only when the loop is clear.",
  },
];

const authorSteps: GuideStep[] = [
  {
    label: "Scaffold",
    detail: "Run npm --workspace @athena/core run athena -- agent scaffold --name \"Research Planner\".",
  },
  {
    label: "Read the manifest",
    detail: "The agent manifest defines inputs, runtime, permissions, limits, and expected artifacts.",
  },
  {
    label: "Edit the runner",
    detail: "The runner reads a task envelope from stdin and writes a serialized output envelope to stdout.",
  },
  {
    label: "Validate and restart",
    detail: "Run manifest validation, restart the API, then confirm the new agent appears in the catalog.",
  },
];

const troubleshooting: GuideStep[] = [
  {
    label: "API will not start",
    detail: "Check Node 20+, npm install, port conflicts, and ATHENA_WORKSPACE_ROOT when running the API directly.",
  },
  {
    label: "Console cannot reach API",
    detail: "Confirm http://127.0.0.1:8787/api/v1/health responds and the local stack started both services.",
  },
  {
    label: "Readiness is degraded",
    detail: "Read each check's nextStep. Missing optional providers can be acceptable; required app-state or plugin failures are not.",
  },
  {
    label: "Agent is missing",
    detail: "Check plugin.yaml, matching agent ids, duplicate id diagnostics, plugin paths, and whether the API was restarted.",
  },
  {
    label: "Provider-backed run is blocked",
    detail: "Check provider kind, secret name, environment availability, and agent provider requirements.",
  },
  {
    label: "Artifact preview fails",
    detail: "Artifact metadata can exist even when the payload is memory-backed, file-backed outside an allowed root, or unsupported for preview.",
  },
];

const glossary: GuideStep[] = [
  { label: "Agent", detail: "A manifest-backed executable unit supplied by a plugin." },
  { label: "Backend", detail: "The execution mechanism for an agent, such as local process, container command, or HTTP/API." },
  { label: "Event", detail: "A structured record of something that happened during execution." },
  { label: "Provider", detail: "A configured model or API backend used by model-backed agents." },
  { label: "Readiness", detail: "Diagnostics that explain whether required local systems are usable." },
  { label: "Workflow run", detail: "A dependency-aware execution record created from a workflow template." },
];

const smokeCommands = `curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:8787/api/v1/readiness
npm run smoke:product`;

const firstRunApi = `curl "http://127.0.0.1:8787/api/v1/workflow-templates?pluginId=team-orchestrator.samples.first-run"

curl -X POST http://127.0.0.1:8787/api/v1/workflow-templates/first-run.demo.workflow/instantiate \\
  -H "content-type: application/json" \\
  -d '{"missionId":"mission-first-run-demo","taskIdPrefix":"first-run-demo","inputs":{"demoName":"First-Run Demo"}}'

curl -X POST http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/execute
curl http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/status`;

const providerEnv = `ATHENA_DEFAULT_PROVIDER=openai
ATHENA_OPENAI_API_KEY=your_api_key_here

# Azure AI Foundry local development can use Entra ID after az login:
ATHENA_DEFAULT_PROVIDER=foundry
ATHENA_FOUNDRY_ENABLED=true
ATHENA_FOUNDRY_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com
ATHENA_FOUNDRY_DEPLOYMENT=<your-deployment-name>`;

const scaffoldCommand = `npm --workspace @athena/core run build
npm --workspace @athena/core run athena -- agent scaffold --name "Research Planner"
npm --workspace @athena/core run validate:manifests`;

export function DocumentationPage() {
  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.key}>Documentation</p>
          <h2 className={styles.pageTitle}>Learn Team Orchestrator</h2>
        </div>
        <div className={styles.headerActions}>
          <Link to="/workflows" className={styles.secondaryCta}>
            <Workflow size={16} /> Run Demo
          </Link>
          <Link to="/tasks" className={styles.primaryCta}>
            <PlayCircle size={16} /> Create Task
          </Link>
        </div>
      </div>

      <p className={styles.lead}>
        This page is the in-product guide. You should be able to understand the system, run the built-in demo, connect real
        work, inspect outputs, and create a plugin-backed agent without opening the source repository.
      </p>

      <section className={styles.docsBand}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Start Here</p>
            <h3 className={styles.resourceTitle}>What the product is for</h3>
          </div>
          <Sparkles size={18} />
        </div>
        <p className={styles.settingsMuted}>
          Team Orchestrator turns agent work into explicit, inspectable operations. Instead of a loose prompt and a
          disappearing answer, you get plugin-backed agents, structured task inputs, run history, events, artifacts,
          provider readiness, and safety limits.
        </p>
        <div className={styles.docsReferenceGrid}>
          <GuideCard
            step={{
              title: "For operators",
              body: "Start with the first-run demo, then connect a repository and run one small read-only task.",
              icon: PlayCircle,
              link: "/workflows",
              linkLabel: "Open workflows",
            }}
          />
          <GuideCard
            step={{
              title: "For agent authors",
              body: "Scaffold a local plugin, edit the manifest and runner, validate, then run it from Tasks.",
              icon: Code2,
              link: "/docs#agent-authoring",
              linkLabel: "Read authoring path",
            }}
          />
          <GuideCard
            step={{
              title: "For admins",
              body: "Use readiness, provider settings, resource controls, and local-server paths to keep the instance healthy.",
              icon: Database,
              link: "/settings",
              linkLabel: "Open settings",
            }}
          />
        </div>
      </section>

      <section className={styles.docsBand}>
        <div>
          <p className={styles.key}>Mental Model</p>
          <h3 className={styles.resourceTitle}>The core nouns</h3>
        </div>
        <div className={styles.docsReferenceGrid}>
          {conceptCards.map((step) => (
            <GuideCard key={step.title} step={step} />
          ))}
        </div>
      </section>

      <section className={styles.docsSplit}>
        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>First Run</p>
              <h3 className={styles.resourceTitle}>Prove the system without credentials</h3>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <GuideList items={firstRunSteps} />
          <pre className={styles.docsCode}>{firstRunApi}</pre>
        </div>

        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Real Work</p>
              <h3 className={styles.resourceTitle}>Move from demo to your repository</h3>
            </div>
            <FolderGit2 size={18} />
          </div>
          <GuideList items={realWorkSteps} />
          <div className={styles.headerActions}>
            <Link to="/resources" className={styles.secondaryCta}>
              <FolderGit2 size={16} /> Resource Controls
            </Link>
            <Link to="/agents" className={styles.secondaryCta}>
              <PlugZap size={16} /> Agent Catalog
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.docsSplit}>
        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Providers</p>
              <h3 className={styles.resourceTitle}>When an agent needs a model</h3>
            </div>
            <KeyRound size={18} />
          </div>
          <p className={styles.settingsMuted}>
            The first-run demo uses the mock provider. Model-backed agents need provider configuration and a secret
            reference. The console stores the reference, not the raw secret.
          </p>
          <pre className={styles.docsCode}>{providerEnv}</pre>
          <Link to="/settings" className={styles.inlineAction}>
            Open provider settings
          </Link>
        </div>

        <div className={styles.docsBand} id="agent-authoring">
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Agent Authoring</p>
              <h3 className={styles.resourceTitle}>Create a plugin-backed agent</h3>
            </div>
            <FileCode2 size={18} />
          </div>
          <GuideList items={authorSteps} />
          <pre className={styles.docsCode}>{scaffoldCommand}</pre>
        </div>
      </section>

      <section className={styles.docsBand}>
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.key}>Inspectability</p>
            <h3 className={styles.resourceTitle}>How to know what happened</h3>
          </div>
          <GitBranch size={18} />
        </div>
        <div className={styles.docsReferenceGrid}>
          <GuideCard
            step={{
              title: "Workflow graph",
              body: "Use workflow run detail to see dependency steps, progress, completed nodes, failures, and linked task-run ids.",
              icon: Workflow,
              link: "/workflows",
              linkLabel: "Open workflows",
            }}
          />
          <GuideCard
            step={{
              title: "Task run detail",
              body: "Inspect terminal status, resolved backend, inputs, events, output, verification, and artifact metadata.",
              icon: ScrollText,
              link: "/tasks",
              linkLabel: "Open tasks",
            }}
          />
          <GuideCard
            step={{
              title: "Product smoke",
              body: "Run one command when you need a fast confidence check before handing the product to someone else.",
              icon: CheckCircle2,
            }}
          />
        </div>
        <pre className={styles.docsCode}>{smokeCommands}</pre>
      </section>

      <section className={styles.docsSplit}>
        <div className={styles.docsBand}>
          <div className={styles.settingsHeader}>
            <div>
              <p className={styles.key}>Troubleshooting</p>
              <h3 className={styles.resourceTitle}>Common failures and where to look</h3>
            </div>
            <AlertCircle size={18} />
          </div>
          <GuideList items={troubleshooting} />
        </div>

        <div className={styles.docsBand}>
          <div>
            <p className={styles.key}>Glossary</p>
            <h3 className={styles.resourceTitle}>Terms you will see in the console</h3>
          </div>
          <GuideList items={glossary} />
        </div>
      </section>

      <section className={styles.docsBand}>
        <div>
          <p className={styles.key}>Next Paths</p>
          <h3 className={styles.resourceTitle}>Where to go from here</h3>
        </div>
        <div className={styles.docsReferenceGrid}>
          <GuideCard
            step={{
              title: "Run a workflow",
              body: "Use a workflow template when a plugin already knows the repeatable task sequence.",
              icon: Workflow,
              link: "/workflows",
              linkLabel: "Open workflows",
            }}
          />
          <GuideCard
            step={{
              title: "Run one task",
              body: "Use a task when you know the exact agent and objective you want to run.",
              icon: PlayCircle,
              link: "/tasks",
              linkLabel: "Create task",
            }}
          />
          <GuideCard
            step={{
              title: "Fix setup",
              body: "Use Settings, Resources, and readiness diagnostics when agents or providers are unavailable.",
              icon: ShieldCheck,
              link: "/settings",
              linkLabel: "Open settings",
            }}
          />
        </div>
      </section>
    </section>
  );
}

function GuideCard({ step }: { step: GuideCard }) {
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

function GuideList({ items }: { items: GuideStep[] }) {
  return (
    <ul className={styles.docsList}>
      {items.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
