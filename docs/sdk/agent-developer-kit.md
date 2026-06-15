<!-- AUDIENCE: Engineer/SDK -->

# Agent Developer Kit (ADK) — `@athena/pdk`

`@athena/pdk` is the code-level Agent Developer Kit for Team Orchestrator plugin authors. Use it to build plugin-backed agents that parse task/run envelopes, validate declared inputs, produce structured output, and emit artifact metadata in the shape the runtime expects.

This is the canonical guide. See the package README at `packages/pdk/README.md` for the one-paragraph summary and install command.

**Related**: For triggering runs and managing tasks via HTTP, see the [SDK and Integration Guide](README.md) and the HTTP API reference (plan 032: `docs/sdk/api/README.md`).

---

## Contents

1. [Overview](#overview)
2. [Plugin and agent layout](#plugin-and-agent-layout)
3. [The run envelope](#the-run-envelope)
4. [Declaring inputs](#declaring-inputs)
5. [Writing a handler with runAgentHandler](#writing-a-handler-with-runagenthandler)
6. [Producing output and artifacts](#producing-output-and-artifacts)
7. [Validation and errors](#validation-and-errors)
8. [Verification status](#verification-status)
9. [Complete worked example](#complete-worked-example)
10. [Capability packs](#capability-packs)
11. [Build, test, and package commands](#build-test-and-package-commands)

---

## Overview

A Team Orchestrator agent is defined by a plugin package on disk. The package declares its agents via manifests; each agent declares its inputs, outputs, runtime backend, permissions, and limits. When the runtime assigns a task to an agent, it builds a JSON task/run envelope and invokes the agent's runner. The runner reads the envelope, validates inputs, executes its logic, and writes serialized output to stdout.

`@athena/pdk` covers the runner side:

- Parse and validate the task/run envelope (`parseAgentTaskRunEnvelope`)
- Parse and validate manifest-declared inputs (`parseAgentInputs`, `parseAgentEnvelopeInputs`)
- Run a typed handler with all of the above wired together (`runAgentHandler`)
- Build and return run output with artifact metadata (`createAgentRunOutput`, `createAgentArtifact`, `serializeAgentRunOutput`)
- Structured validation errors with per-field issues (`AgentSdkValidationError`)

The package does **not** manage model providers, credential resolution, artifact payload storage, manifest generation, or runtime backend selection. Those concerns belong to the runtime, not the runner.

---

## Plugin and agent layout

A plugin package is a directory with a `plugin.yaml` manifest at the root. The manifest declares the plugin's identity and lists the agents it contains. Each agent has its own `agents/*.agent.yaml` manifest.

```text
my-plugin/
  plugin.yaml
  agents/
    research.agent.yaml
    research-runner.mjs
  schemas/
    research-options.schema.json
  docs/
    README.md
```

### plugin.yaml

```yaml
schemaVersion: 1
plugin:
  id: local.examples.research
  name: Research Agent Plugin
  version: 0.1.0
  description: Plugin providing a local research planner agent.
  authors:
    - name: Local Operator
  agents:
    - path: agents/research.agent.yaml
      id: local.research.plan
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
    durableMemory:
      propose:
        namespaces:
          - research/*
        maxSensitivity: internal
        reason: Allow operator-reviewed memory proposals for research outputs.
  ui:
    icon: search
    color: "#3b7c6e"
    tags:
      - local
      - research
```

Key rules:

- `plugin.id` must be unique across all configured plugin paths.
- The `agents` array entries pin the `id` and `version` the loader expects to find in each agent manifest; mismatches produce catalog validation errors.
- `compatibility.manifestSchema` must be `team-orchestrator.manifests.v1`.
- `permissions.durableMemory` is default-deny; declare only what the plugin needs.

### agents/research.agent.yaml

```yaml
schemaVersion: 1
agent:
  id: local.research.plan
  name: Research Planner
  version: 0.1.0
  description: Produces a research plan artifact from a topic.
  capabilities:
    - research.plan
    - artifacts.produce
  inputs:
    topic:
      type: string
      required: true
      label: Topic
      description: The subject to research.
    maxItems:
      type: integer
      required: false
      default: 3
      label: Max items
      description: Number of research items to include.
    format:
      type: enum
      required: false
      default: markdown
      enum:
        - markdown
        - plain
      label: Output format
  outputs:
    mode: flexible
    artifacts:
      - key: plan
        label: Research Plan
        kind: primary
        format: markdown
  implementation:
    type: local-command
    command: node
    args:
      - agents/research-runner.mjs
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
    maxOutputBytes: 65536
    maxArtifacts: 1
  observability:
    mode: inspectable
  compatibility:
    teamOrchestrator: ">=0.1.0"
    pluginApi: team-orchestrator.manifests.v1
```

The agent manifest is the task-facing contract. The console reads it through the catalog index to display inputs, capabilities, limits, and safety metadata.

### Scaffold command

The `@athena/core` CLI can generate a starter plugin directory:

```bash
npm --workspace @athena/core run build
npm --workspace @athena/core run athena -- agent scaffold --name "Research Planner"
```

This writes to `.athena/plugins/` by default. Use `--plugins-dir <path>`, `--plugin-id <id>`, or `--agent-id <id>` for explicit placement.

### Starting from a sample

The fastest path to a model-backed agent is copying an existing sample:

```bash
cp -R sample-plugins/model-provider-smoke sample-plugins/local-user-test
```

Then edit `plugin.yaml` and `agents/*.agent.yaml` to change `plugin.id`, `plugin.name`, `agent.id`, and `agent.name`. The `plugin.yaml` agent entry and the agent manifest must agree on `id` and `version`. Update the artifact `storageUri` namespace in the runner to match your new plugin name. See `sample-plugins/` for reference implementations:

- `first-run-demo/` — minimal onboarding agent
- `model-provider-smoke/` — OpenAI-compatible model-backed agent
- `repo-summary/` — repository-aware summarizer
- `code-review/` — code review agent
- `generic-research/` — research agent
- `local-user-test/` — local development test copy

---

## The run envelope

When the runtime invokes a local-command agent, it writes a JSON task/run envelope to the runner's stdin. The envelope has this shape (`AgentTaskRunEnvelope`):

```typescript
interface AgentTaskRunEnvelope {
  task: {
    id: string;           // required: non-empty
    title?: string;
    description?: string;
    inputs?: unknown;     // the task's input values
    [key: string]: unknown;
  };
  agent: {
    id: string;           // required: non-empty
    version?: string;
    [key: string]: unknown;
  };
  run: {
    id: string;           // required: non-empty
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
```

Parse it with `parseAgentTaskRunEnvelope`:

```js
import { parseAgentTaskRunEnvelope } from "@athena/pdk";

const raw = await readStdin();
const envelope = parseAgentTaskRunEnvelope(raw); // throws AgentSdkValidationError if malformed
```

`parseAgentTaskRunEnvelope` accepts either a JSON string or a plain object. It throws `AgentSdkValidationError` if `task.id`, `agent.id`, or `run.id` are absent or empty (agent.ts:112–127).

The convenience properties `envelope.task`, `envelope.agent`, and `envelope.run` give direct access to the three required sub-objects.

---

## Declaring inputs

### AgentInputContract and AgentInputField

An `AgentInputContract` is a `Record<string, AgentInputField>` — a named map of field definitions that mirrors the `agent.inputs` section of the agent manifest. You declare it in the runner code and pass it to the parse helpers.

```typescript
type AgentInputContract = Record<string, AgentInputField>;

interface AgentInputField {
  type: AgentInputFieldType;
  required?: boolean;
  description?: string;
  label?: string;
  default?: unknown;
  schema?: string;         // path to a JSON Schema file for "object" fields
  enum?: Array<string | number | boolean>; // required when type is "enum"
  ui?: {
    widget?: "text" | "textarea" | "markdown" | "number" | "checkbox" | "select" | "file" | "json";
    placeholder?: string;
    order?: number;
  };
}
```

### Field types

All valid `AgentInputFieldType` values and how `parseAgentInputs` validates each (agent.ts:232–256):

| Type | Validation rule |
| --- | --- |
| `"string"` | `typeof value === "string"` |
| `"markdown"` | `typeof value === "string"` (same check as string) |
| `"file"` | `typeof value === "string"` (path or URI) |
| `"url"` | `typeof value === "string"` (URL form) |
| `"number"` | `typeof value === "number" && Number.isFinite(value)` |
| `"integer"` | `typeof value === "number" && Number.isInteger(value)` |
| `"boolean"` | `typeof value === "boolean"` |
| `"object"` | plain object (not array, not null) |
| `"array"` | `Array.isArray(value)` |
| `"json"` | any value (no runtime type restriction) |
| `"enum"` | value must be in `field.enum` (must declare `enum` array in field definition) |

`"json"` passes through any value without a runtime type check. Use it for flexible structured inputs when you will validate shape yourself.

### Parsing inputs

```js
import { parseAgentInputs, parseAgentEnvelopeInputs } from "@athena/pdk";

const inputContract = {
  topic: { type: "string", required: true, label: "Topic" },
  maxItems: { type: "integer", default: 3, label: "Max items" },
  format: { type: "enum", default: "markdown", enum: ["markdown", "plain"] }
};

// From an explicit inputs object:
const inputs = parseAgentInputs(inputContract, rawInputs);

// From the envelope's task.inputs directly:
const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
```

`parseAgentInputs` behavior (agent.ts:129–163):

1. If a field value is absent and a `default` is declared, applies the default.
2. If a field value is absent and `required: true`, records a validation issue.
3. If a field value is present, calls `validateInputValue` for type checking.
4. If any issues were recorded, throws `AgentSdkValidationError` with the full `issues[]`.

`parseAgentEnvelopeInputs(envelope, contract)` is shorthand for `parseAgentInputs(contract, envelope.task.inputs)`.

---

## Writing a handler with runAgentHandler

`runAgentHandler` is the recommended entry point for new runners. It combines envelope parsing, input resolution, and handler invocation in one call.

### Handler type

```typescript
type AgentHandler<TInputs, TOutput> = (
  context: AgentHandlerContext<TInputs>
) => AgentRunOutputEnvelope<TOutput> | Promise<AgentRunOutputEnvelope<TOutput>>;

interface AgentHandlerContext<TInputs> {
  envelope: AgentTaskRunEnvelope; // the full parsed envelope
  inputs: TInputs;                // validated/defaulted inputs
  task: AgentTaskRunEnvelope["task"];
  agent: AgentTaskRunEnvelope["agent"];
  run: AgentTaskRunEnvelope["run"];
}
```

### runAgentHandler options and input-resolution precedence

```typescript
interface RunAgentHandlerOptions<TInputs> {
  envelope: AgentTaskRunEnvelope | string; // string is parsed as JSON
  inputContract?: AgentInputContract;
  inputs?: TInputs;
}
```

Input-resolution order (agent.ts:214):

1. `options.inputs` — if provided, used directly (no contract parse).
2. `options.inputContract` — if provided and `options.inputs` is absent, calls `parseAgentEnvelopeInputs(envelope, inputContract)`.
3. Fallback — `envelope.task.inputs` cast to `TInputs` (no validation).

### Usage

```js
import {
  runAgentHandler,
  createAgentRunOutput,
  createAgentArtifact,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  topic: { type: "string", required: true },
  maxItems: { type: "integer", default: 3 }
};

const result = await runAgentHandler(
  async ({ inputs, agent, run }) => {
    const markdown = renderPlan(inputs.topic, inputs.maxItems);
    return createAgentRunOutput(
      { topic: inputs.topic, maxItems: inputs.maxItems },
      {
        artifacts: [
          createAgentArtifact({
            label: "Research Plan",
            kind: "primary",
            format: "markdown",
            storageUri: `memory://research/${encodeURIComponent(run.id)}/plan.md`
          })
        ]
      }
    );
  },
  { envelope: rawEnvelopeString, inputContract }
);

process.stdout.write(serializeAgentRunOutput(result));
```

For runners that read stdin directly, `envelope` can be the raw JSON string from stdin. `runAgentHandler` calls `parseAgentTaskRunEnvelope` internally.

---

## Producing output and artifacts

### createAgentRunOutput

```typescript
function createAgentRunOutput<TOutput>(
  output: TOutput,
  options?: {
    artifacts?: AgentRunArtifact[];
    verificationStatus?: AgentRunVerificationStatus;
    verificationFailures?: AgentRunVerificationFailure[];
  }
): AgentRunOutputEnvelope<TOutput>
```

- `output` is any serializable value representing the agent's structured result.
- `artifacts` is run through `createAgentArtifact` for each entry (defaults applied).
- Returns `AgentRunOutputEnvelope<TOutput>`.

### createAgentArtifact

```typescript
function createAgentArtifact(artifact: AgentRunArtifact): AgentRunArtifact
```

`AgentRunArtifact` shape:

```typescript
interface AgentRunArtifact {
  id?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;    // required; must be non-empty
  sizeBytes?: number;
  hash?: string;
  metadata?: unknown;
  schemaValidation?: unknown;
}
```

`createAgentArtifact` throws `AgentSdkValidationError` if `storageUri` is absent or blank. Default behavior (agent.ts:172–187):

- `label` defaults to `"Artifact"` if blank.
- `kind` defaults to `"supporting"` if blank.
- `format` defaults to `"text"` if blank.

Convention for `kind`: use `"primary"` for the main artifact the agent was asked to produce, and `"supporting"` for supplemental data.

Convention for `storageUri`: use `memory://<namespace>/<run-id>/<filename>` for local in-memory storage, or a provider-defined URI scheme for remote storage.

### serializeAgentRunOutput

```typescript
function serializeAgentRunOutput(envelope: AgentRunOutputEnvelope): string
```

Returns `JSON.stringify(envelope) + "\n"` (agent.ts:205–207). Write this to stdout:

```js
process.stdout.write(serializeAgentRunOutput(result));
```

### AgentRunOutputEnvelope shape

```typescript
interface AgentRunOutputEnvelope<TOutput = unknown> {
  output: TOutput;
  artifacts: AgentRunArtifact[];
  verificationStatus?: AgentRunVerificationStatus;
  verificationFailures?: AgentRunVerificationFailure[];
}
```

---

## Validation and errors

### AgentSdkValidationError

```typescript
class AgentSdkValidationError extends Error {
  readonly issues: AgentInputValidationIssue[];
}

interface AgentInputValidationIssue {
  path: string;   // field key
  message: string;
}
```

`AgentSdkValidationError` is thrown by:

- `parseAgentTaskRunEnvelope` — when `task.id`, `agent.id`, or `run.id` are missing or empty.
- `parseAgentInputs` / `parseAgentEnvelopeInputs` — when required fields are absent or field values fail type checks.
- `createAgentArtifact` — when `storageUri` is absent or blank.

In all cases, `error.issues` contains one entry per problem (path + message). For envelope errors, `issues` is an empty array.

### Error handling pattern

```js
try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  // ... your logic ...
  process.stdout.write(serializeAgentRunOutput(result));
} catch (error) {
  if (error instanceof AgentSdkValidationError) {
    for (const issue of error.issues) {
      process.stderr.write(`[${issue.path}] ${issue.message}\n`);
    }
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
}
```

Validation is fail-closed: if any required field is missing or any present field fails type checks, `parseAgentInputs` collects all issues before throwing. The runner receives the full list in a single error.

---

## Verification status

Run output can carry an optional verification status and list of failures:

```typescript
type AgentRunVerificationStatus = "passed" | "verification-failed";

interface AgentRunVerificationFailure {
  policyId: string;
  kind: "require-evidence";
  message: string;
  details?: Record<string, string>;
}
```

Use this when the agent enforces a policy gate (for example, requiring that an artifact was produced before marking the run as passing):

```js
const hasArtifact = artifacts.length > 0;
return createAgentRunOutput(
  { summary: "..." },
  {
    artifacts,
    verificationStatus: hasArtifact ? "passed" : "verification-failed",
    verificationFailures: hasArtifact ? [] : [
      {
        policyId: "require-primary-artifact",
        kind: "require-evidence",
        message: "No primary artifact was produced."
      }
    ]
  }
);
```

---

## Complete worked example

This example builds the full research planner plugin from scratch: manifests, runner, test, and local validation.

### Plugin manifest (`plugin.yaml`)

```yaml
schemaVersion: 1
plugin:
  id: local.examples.research
  name: Research Agent Plugin
  version: 0.1.0
  description: Produces deterministic research plan artifacts.
  authors:
    - name: Local Operator
  agents:
    - path: agents/research.agent.yaml
      id: local.research.plan
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
    icon: search
    color: "#3b7c6e"
    tags:
      - local
      - research
```

### Agent manifest (`agents/research.agent.yaml`)

```yaml
schemaVersion: 1
agent:
  id: local.research.plan
  name: Research Planner
  version: 0.1.0
  description: Produces a research plan artifact from a topic and item count.
  capabilities:
    - research.plan
  inputs:
    topic:
      type: string
      required: true
      label: Topic
      description: The subject to research.
    maxItems:
      type: integer
      required: false
      default: 3
      label: Max items
  outputs:
    mode: flexible
    artifacts:
      - key: plan
        label: Research Plan
        kind: primary
        format: markdown
  implementation:
    type: local-command
    command: node
    args:
      - agents/research-runner.mjs
  runtime:
    preferredBackend: local-process
  permissions:
    network: deny
    filesystem: scoped
    shell: allow
    credentials: deny
  limits:
    maxRuntimeSeconds: 30
    maxToolCalls: 0
    maxArtifacts: 1
  compatibility:
    teamOrchestrator: ">=0.1.0"
    pluginApi: team-orchestrator.manifests.v1
```

### Runner (`agents/research-runner.mjs`)

```js
import {
  AgentSdkValidationError,
  createAgentArtifact,
  createAgentRunOutput,
  runAgentHandler,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  topic: { type: "string", required: true, label: "Topic" },
  maxItems: { type: "integer", default: 3, label: "Max items" }
};

try {
  const result = await runAgentHandler(
    async ({ inputs, agent, run }) => {
      const markdown = renderPlan(inputs.topic, inputs.maxItems);
      return createAgentRunOutput(
        {
          topic: inputs.topic,
          maxItems: inputs.maxItems,
          summary: `Prepared ${inputs.maxItems} research items for: ${inputs.topic}`
        },
        {
          artifacts: [
            createAgentArtifact({
              id: `research-plan-${run.id}`,
              label: "Research Plan",
              kind: "primary",
              format: "markdown",
              storageUri: `memory://research/${encodeURIComponent(run.id)}/plan.md`,
              metadata: { generatedBy: agent.id }
            })
          ]
        }
      );
    },
    { envelope: await readStdin(), inputContract }
  );

  process.stdout.write(serializeAgentRunOutput(result));
} catch (error) {
  if (error instanceof AgentSdkValidationError) {
    for (const issue of error.issues) {
      process.stderr.write(`[${issue.path}] ${issue.message}\n`);
    }
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exitCode = 1;
}

async function readStdin() {
  let body = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) body += chunk;
  return body;
}

function renderPlan(topic, maxItems) {
  const items = Array.from({ length: maxItems }, (_, i) => `${i + 1}. Research item for: ${topic}`);
  return [`# Research Plan`, "", `Topic: ${topic}`, "", ...items].join("\n");
}
```

### Handler test (`agents/research-runner.test.mjs`)

Use `runAgentHandler` in tests to exercise envelope parsing and input validation without spawning a child process:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgentArtifact,
  createAgentRunOutput,
  runAgentHandler,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  topic: { type: "string", required: true },
  maxItems: { type: "integer", default: 3 }
};

test("research runner output shape", async () => {
  const envelope = {
    task: { id: "task-1", inputs: { topic: "workspace notes" } },
    agent: { id: "local.research.plan", version: "0.1.0" },
    run: { id: "run-1" }
  };

  const result = await runAgentHandler(
    async ({ inputs, agent, run }) =>
      createAgentRunOutput(
        { topic: inputs.topic, maxItems: inputs.maxItems },
        {
          artifacts: [
            createAgentArtifact({
              label: "Research Plan",
              kind: "primary",
              format: "markdown",
              storageUri: `memory://research/${encodeURIComponent(run.id)}/plan.md`
            })
          ]
        }
      ),
    { envelope: JSON.stringify(envelope), inputContract }
  );

  assert.equal(result.output.topic, "workspace notes");
  assert.equal(result.output.maxItems, 3);            // default applied
  assert.equal(result.artifacts[0].storageUri, "memory://research/run-1/plan.md");
  assert.equal(serializeAgentRunOutput(result), `${JSON.stringify(result)}\n`);
});

test("research runner rejects missing required input", async () => {
  const envelope = {
    task: { id: "task-2", inputs: {} },
    agent: { id: "local.research.plan", version: "0.1.0" },
    run: { id: "run-2" }
  };

  await assert.rejects(
    () => runAgentHandler(
      async (ctx) => createAgentRunOutput({ topic: ctx.inputs.topic }, {}),
      { envelope: JSON.stringify(envelope), inputContract }
    ),
    (err) => {
      assert.ok(err.issues.some((i) => i.path === "topic"));
      return true;
    }
  );
});
```

### Load and run locally

Place the plugin under a configured `ATHENA_PLUGIN_PATHS` directory. Build the PDK and validate:

```bash
npm --workspace @athena/pdk run build
npm --workspace @athena/core run build
node --input-type=module -e '
  import { validatePluginPackage } from "@athena/core/control-plane/manifests/index";
  const result = validatePluginPackage("path/to/my-plugin");
  if (!result.ok) { console.error(result.issues); process.exit(1); }
  console.log("ok");
'
```

Start the API and verify the agent appears in the catalog:

```bash
npm --workspace @athena/core run athena -- api serve --host 127.0.0.1 --port 8787
curl "http://127.0.0.1:8787/api/v1/agent-catalog/agents?capabilities=research.plan"
```

Create and run a task via HTTP (see the HTTP API reference for full endpoint documentation):

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{
    "id": "task-research-1",
    "title": "Research workspace notes",
    "status": "ready",
    "capabilityRequirements": ["research.plan"],
    "assignedAgentId": "local.research.plan",
    "assignedAgentVersion": "0.1.0",
    "inputs": { "topic": "workspace notes", "maxItems": 5 }
  }'

curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-research-1/run \
  -H "content-type: application/json" \
  -d '{}'
```

---

## Capability packs

A capability pack is a standard Team Orchestrator plugin package that groups agents, workflow templates, docs, fixtures, and validation evidence around a useful capability area. First-party bundled packs and user-authored local packs use the same manifest model.

The canonical reference for bundled packs is `bundled-plugins/software-team/`. The connector pack reference is `bundled-plugins/connector-platform/`.

### Pack structure

```text
my-capability-pack/
  plugin.yaml
  agents/
    my-agent.agent.yaml
  workflows/
    my-workflow.workflow.yaml
  fixtures/
    my-workflow.inputs.json
  docs/
    README.md
  scripts/
    optional-runner.mjs
```

Required for a useful pack:

- `plugin.yaml` with `plugin.pack` metadata, compatibility, permissions, and references to agents or workflows.
- At least one `agents/*.agent.yaml` when the pack provides runnable work.
- At least one `workflows/*.workflow.yaml` when the pack demonstrates a repeatable sequence.
- At least one deterministic JSON fixture under `fixtures/`.
- A `docs/README.md` explaining what the pack does and what setup it needs.

### Pack metadata in plugin.yaml

Pack metadata lives under `plugin.pack`:

```yaml
plugin:
  pack:
    category: software-team
    maturity: preview
    credentialRequirements:
      - none
    memoryRequirements:
      - none
    safety:
      posture: read-only
      externalWrites: false
      notes: Uses deterministic local fixtures; does not modify external systems.
    exampleWorkflows:
      - path: workflows/release-readiness.workflow.yaml
        id: bundled.software-team.release-readiness.workflow
        version: 0.1.0
```

Console mapping:

- `category` — appears in pack filters and badges. Valid values: `software-team`, `research`, `knowledge-work`, `operations`, `connector`, `example`.
- `maturity` — one of `experimental`, `preview`, `stable`.
- `credentialRequirements` — tells operators what setup is expected: `none`, `model-provider`, `connector-account`, or `local-filesystem`.
- `memoryRequirements` — declares durable-memory needs: `none`, `read`, `propose`, `write-reviewed`, or `semantic-search`.
- `safety.posture` and `safety.externalWrites` — become safety requirement labels before an operator starts work.
- `exampleWorkflows` — points to workflow templates that demonstrate the pack.

User-authored plugins may omit `plugin.pack`. First-party bundled packs should include it.

### Connector metadata

Connector metadata lives under `plugin.connector` when a pack needs external service credentials, scopes, rate limits, or operation classes:

```yaml
plugin:
  connector:
    service:
      id: fixture.service
      name: Fixture Service
    auth:
      type: api-token
      credentialBinding: required
    scopes:
      - id: fixture:read
        label: Read fixture records
        required: true
        access: read
    operations:
      - id: list-records
        class: read
        scopes:
          - fixture:read
      - id: create-record
        class: external-write
        scopes:
          - fixture:write
        approvalRequired: true
```

Connector rules:

- Put connector declarations in the manifest, not task prose.
- Use credential binding references for secrets; never put secret values in manifests, fixtures, task inputs, runs, or artifacts.
- Declare every required scope with a human-readable label.
- Classify operations as `read` or `external-write`.
- External-write operations must declare `approvalRequired: true`.
- Rate limits should describe local operator expectations and fixture behavior before any pack makes live API calls.

### Agents and workflows in a pack

Agents should declare narrow capabilities and explicit limits. Prefer no-provider or mock-provider behavior for examples intended to run during local validation.

Workflows should assign tasks to pack agents when the sequence is smokeable:

```yaml
workflow:
  tasks:
    - id: review
      title: Review release readiness
      capabilityRequirements:
        - release.review
      assignedAgentId: bundled.software-team.release-readiness.local
      assignedAgentVersion: 0.1.0
```

Keep workflow inputs explicit so the console can render forms and fixture JSON can remain small.

### Fixtures

Fixtures should be deterministic and local:

```json
{
  "workflowId": "bundled.software-team.release-readiness.workflow",
  "inputs": {
    "releaseName": "2026.1-fixture",
    "scope": "Confirm that the workflow can instantiate with deterministic local inputs."
  }
}
```

Avoid fixtures that depend on live third-party services unless the pack specifically validates connector readiness. Connector fixture JSON must include `connectorFixture.liveNetwork: false` and cover: `read-success`, `write-blocked`, `write-approved`, `auth-missing`, `scope-missing`, `rate-limited`.

### Pack validation

```bash
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run validate:pack-fixtures
npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts
```

For console-facing metadata changes:

```bash
npm --workspace @athena/console run typecheck
npm --workspace @athena/console run test
```

### Local installation

User-authored packs live under any configured `ATHENA_PLUGIN_PATHS` directory, including `.athena/plugins/`. First-party bundled packs live under `bundled-plugins/` and are indexed as system plugins through the default system plugin search path.

Do not bypass the plugin model for first-party packs. If a capability needs to appear in the console, make it a plugin-backed agent or workflow and let the catalog index it.

---

## Build, test, and package commands

### PDK package

```bash
# Type-check only
npm --workspace @athena/pdk run typecheck

# Build (emits to packages/pdk/dist/)
npm --workspace @athena/pdk run build

# Unit tests
npm --workspace @athena/pdk run test
```

### Core and manifest validation

```bash
# Build core (required before validatePluginPackage or athena CLI)
npm --workspace @athena/core run build

# Validate all bundled manifests
npm --workspace @athena/core run validate:manifests

# Validate bundled pack fixtures
npm --workspace @athena/core run validate:pack-fixtures
```

### Manifest schema reference

The manifest schema source is at `packages/core/schemas/team-orchestrator/manifests/v1/`:

- `plugin.schema.json` — validates `plugin.yaml`
- `agent.schema.json` — validates `*.agent.yaml`
- `workflow.schema.json` — validates `*.workflow.yaml`
- `examples/` — validation fixtures for common plugin shapes

Schema versioning is explicit. Manifest documents use `schemaVersion: 1`. Breaking changes create a new versioned schema directory rather than editing v1 in place.

### Documentation link check

```bash
npm run check:docs
```

Expected output: `Checked relative markdown links in N files. No broken links.`

Stage new or moved files with `git add` before running the check — the checker uses `git ls-files`.

---

*For triggering runs and managing tasks programmatically, see the [HTTP API reference](README.md#2-http-control-plane-api-reference).*
