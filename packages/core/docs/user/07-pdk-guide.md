# Build Your First Agent

This guide takes you from an empty local plugin directory to a loaded Team Orchestrator agent and a completed task run.

Agents are not normally authored inside the console. The console is where operators inspect installed agents, create tasks, run work, and review artifacts. The source of truth for an agent is a plugin package on disk:

- `plugin.yaml` declares the plugin and the agents it contains.
- `agents/*.agent.yaml` declares each agent contract, inputs, outputs, runtime, permissions, and limits.
- runner files implement local behavior.
- optional `schemas/*.schema.json` files document structured inputs.

The `@athena/pdk` package helps runners parse task envelopes, validate inputs, create artifacts, and serialize run output.

## 1. Create An Empty Plugin

From the repository root:

```bash
mkdir -p plugins/hello-agent/agents plugins/hello-agent/schemas plugins/hello-agent/docs
```

Point Team Orchestrator at your local plugin directory:

```bash
cat > .env <<'EOF'
ATHENA_PLUGIN_PATHS=plugins
EOF
```

If you already have an `.env`, add `plugins` to the existing comma-separated `ATHENA_PLUGIN_PATHS` value instead of replacing the file.

## 2. Add The Plugin Manifest

Create `plugins/hello-agent/plugin.yaml`:

```yaml
schemaVersion: 1
plugin:
  id: local.examples.hello-agent
  name: Hello Agent
  version: 0.1.0
  description: Minimal local plugin-backed agent built with the Team Orchestrator PDK.
  authors:
    - name: Local Operator
  agents:
    - path: agents/hello.agent.yaml
      id: local.hello.echo
      version: 0.1.0
  docs:
    readme: docs/README.md
  compatibility:
    teamOrchestrator: ">=0.1.0"
    manifestSchema: team-orchestrator.manifests.v1
    runtimeBackends:
      - local-process
    platforms:
      - any
  permissions:
    network: deny
    filesystem: scoped
    shell: allow
    credentials: deny
  ui:
    icon: message-square-text
    color: "#3b7c6e"
    tags:
      - local
      - tutorial
```

`plugin.yaml` is canonical for plugin identity and resource references. The `agents` entry pins the agent id and version that the loader expects to find in the agent manifest.

## 3. Add The Agent Manifest

Create `plugins/hello-agent/agents/hello.agent.yaml`:

```yaml
schemaVersion: 1
agent:
  id: local.hello.echo
  name: Hello Echo Agent
  version: 0.1.0
  description: Accepts a message and returns a markdown greeting artifact.
  capabilities:
    - tutorial.echo
    - text.transform
    - artifacts.produce
  inputs:
    message:
      type: string
      required: true
      label: Message
      description: Message to echo in the greeting artifact.
    options:
      type: object
      required: false
      label: Options
      description: Optional tone or audience fields.
      schema: schemas/hello-options.schema.json
  outputs:
    mode: flexible
    artifacts:
      - key: greeting
        label: Greeting
        kind: primary
        format: markdown
  implementation:
    type: local-command
    command: node
    args:
      - agents/hello-runner.mjs
  runtime:
    preferredBackend: local-process
    backendPreferences:
      - local-process
    workingDirectory: .
  permissions:
    network: deny
    filesystem: scoped
    shell: allow
    credentials: deny
  limits:
    maxRuntimeSeconds: 30
    maxToolCalls: 0
    maxRepeatedActions: 1
    maxRetries: 0
    maxFollowUpTasks: 0
    maxOutputBytes: 32768
    maxArtifacts: 1
  observability:
    mode: inspectable
  compatibility:
    teamOrchestrator: ">=0.1.0"
    pluginApi: team-orchestrator.manifests.v1
```

The agent manifest is canonical for task-facing inputs and runtime behavior. The console reads this file through the catalog index; it does not become an agent-authoring editor.

## 4. Add An Input Schema

Create `plugins/hello-agent/schemas/hello-options.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Hello Agent Options",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "tone": {
      "type": "string"
    },
    "audience": {
      "type": "string"
    }
  }
}
```

Schemas are optional, but they make structured inputs easier to inspect and eventually easier to render in forms.

## 5. Implement The Runner

Create `plugins/hello-agent/agents/hello-runner.mjs`:

```js
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  message: {
    type: "string",
    required: true
  },
  options: {
    type: "object"
  }
};

try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const options = readOptions(inputs.options);
  const markdown = renderGreeting(inputs.message, options);
  const artifact = createAgentArtifact({
    id: `hello-greeting-${envelope.run.id}`,
    label: "Greeting",
    kind: "primary",
    format: "markdown",
    storageUri: `memory://hello-agent/${encodeURIComponent(envelope.run.id)}/greeting.md`,
    metadata: {
      deterministic: true,
      networkAccess: "denied"
    }
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          message: inputs.message,
          greetingMarkdown: markdown
        },
        {
          artifacts: [artifact]
        }
      )
    )
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function readStdin() {
  let body = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  return body;
}

function readOptions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function renderGreeting(message, options) {
  const tone = typeof options.tone === "string" && options.tone.trim() ? options.tone.trim() : "plain";
  const audience = typeof options.audience === "string" && options.audience.trim() ? options.audience.trim() : "operator";
  return [`# Greeting`, "", `Audience: ${audience}`, `Tone: ${tone}`, "", message].join("\n");
}
```

This runner is deliberately deterministic and local. Replace `renderGreeting` with richer logic as your agent grows, but keep the envelope parsing, input validation, and output serialization shape.

## 6. Add Minimal Plugin Docs

Create `plugins/hello-agent/docs/README.md`:

```md
# Hello Agent

Local tutorial plugin for building a first Team Orchestrator agent.

- Plugin id: `local.examples.hello-agent`
- Agent id: `local.hello.echo`
- Capability: `tutorial.echo`
- Runtime backend: `local-process`
- Network: denied
```

## 7. Validate The Manifest Package

Build the core and PDK packages, then validate your plugin package directly:

```bash
npm --workspace @athena/pdk run build
npm --workspace @athena/core run build
node --input-type=module -e 'import { validatePluginPackage } from "@athena/core/control-plane/manifests/index"; const result = validatePluginPackage("plugins/hello-agent"); if (!result.ok) { console.error(result.issues); process.exit(1); } console.log("ok plugins/hello-agent");'
```

Also keep the checked-in manifest examples healthy:

```bash
npm --workspace @athena/core run validate:manifests
```

## 8. Start The API And Console

In one terminal:

```bash
npm --workspace @athena/core run build
npm run athena -- api serve --host 127.0.0.1 --port 8787
```

In another terminal:

```bash
npm --workspace @athena/console run dev
```

Open the console at `http://127.0.0.1:5173/agents`. The Hello Agent should appear in the agent catalog with the `tutorial.echo` capability.

You can also confirm through the API:

```bash
curl "http://127.0.0.1:8787/api/v1/agent-catalog/agents?capabilities=tutorial.echo"
```

If the agent does not appear, check the plugin catalog response for validation or load errors:

```bash
curl "http://127.0.0.1:8787/api/v1/agent-catalog/plugins"
```

## 9. Create And Run A Task

Create a ready task assigned to the new agent:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{
    "id": "task-hello-agent",
    "title": "Run hello agent",
    "status": "ready",
    "capabilityRequirements": ["tutorial.echo"],
    "assignedAgentId": "local.hello.echo",
    "assignedAgentVersion": "0.1.0",
    "inputs": {
      "message": "Hello from my first plugin-backed agent.",
      "options": {
        "tone": "friendly",
        "audience": "local operator"
      }
    }
  }'
```

Run it:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-hello-agent/run \
  -H "content-type: application/json" \
  -d '{}'
```

The run should return `status: "completed"` with `greetingMarkdown` in the output. Use the returned run id to inspect artifacts:

```bash
curl "http://127.0.0.1:8787/api/v1/task-runs/<run-id>"
```

## 10. Generalize The Pattern

To build a real agent:

1. Start with a small plugin directory and one agent manifest.
2. Use clear namespaced capabilities such as `article.summarize` or `repo.inspect`.
3. Keep permissions narrow, especially `network`, `filesystem`, and `credentials`.
4. Use `@athena/pdk` helpers in the runner.
5. Return structured output plus artifact metadata.
6. Validate the plugin package before starting the API.
7. Confirm the agent in the console catalog before creating tasks.

For larger examples, compare the checked-in sample plugins:

- `sample-plugins/repo-summary`
- `sample-plugins/generic-research`
- `sample-plugins/code-review`

These samples show how to move from the minimal tutorial agent to repo-oriented, code-review, and agentl research agents while keeping the manifest-backed model intact.
