# Agent Developer Kit

`@athena/pdk` is the code-level Agent Developer Kit for Team Orchestrator plugin authors.

Use it when you are writing a plugin-backed agent runner that needs to read a task/run envelope, validate task inputs declared in an agent manifest, return structured output, and report artifact metadata in the shape the runtime expects.

The package name remains `@athena/pdk` for now, but the supported product concept is the Agent Developer Kit.

## What It Provides

- Task/run envelope parsing with `parseAgentTaskRunEnvelope`.
- Manifest-shaped input validation with `parseAgentInputs` and `parseAgentEnvelopeInputs`.
- Typed agent handler execution with `runAgentHandler`.
- Run output and artifact builders with `createAgentRunOutput` and `createAgentArtifact`.
- Output serialization with `serializeAgentRunOutput`.
- Compatibility exports for older specialist/persona helpers.

## Plugin-Backed Agent Shape

A Team Orchestrator agent lives in a plugin package on disk:

```text
plugin.yaml
agents/
  research.agent.yaml
  research-runner.mjs
docs/
  README.md
```

The plugin manifest points at the agent manifest:

```yaml
schemaVersion: 1
plugin:
  id: local.examples.research
  name: Research Agent
  version: 0.1.0
  agents:
    - path: agents/research.agent.yaml
      id: local.research.plan
      version: 0.1.0
  compatibility:
    teamOrchestrator: ">=0.1.0"
    manifestSchema: team-orchestrator.manifests.v1
```

The agent manifest declares the task-facing contract:

```yaml
schemaVersion: 1
agent:
  id: local.research.plan
  name: Research Planner
  version: 0.1.0
  description: Produces a small research plan artifact from a topic.
  inputs:
    topic:
      type: string
      required: true
      label: Topic
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
```

## Runner Example

This runner reads the envelope from stdin, validates manifest-shaped inputs, creates an artifact metadata record, and writes the serialized run output to stdout.

```js
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  topic: {
    type: "string",
    required: true,
    label: "Topic"
  },
  maxItems: {
    type: "integer",
    default: 3,
    label: "Max items"
  }
};

try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const markdown = renderPlan(inputs.topic, inputs.maxItems);

  const output = createAgentRunOutput(
    {
      topic: inputs.topic,
      maxItems: inputs.maxItems,
      summary: `Prepared ${inputs.maxItems} research items for ${inputs.topic}.`
    },
    {
      artifacts: [
        createAgentArtifact({
          id: `research-plan-${envelope.run.id}`,
          label: "Research Plan",
          kind: "primary",
          format: "markdown",
          storageUri: `memory://local-research/${encodeURIComponent(envelope.run.id)}/plan.md`,
          metadata: {
            generatedBy: envelope.agent.id,
            preview: markdown.slice(0, 120)
          }
        })
      ]
    }
  );

  process.stdout.write(serializeAgentRunOutput(output));
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

function renderPlan(topic, maxItems) {
  return [`# Research Plan`, "", `Topic: ${topic}`, "", `Items: ${maxItems}`].join("\n");
}
```

For a full file-by-file tutorial, use [Build Your First Agent](../core/docs/user/07-pdk-guide.md). For a model-backed starting point, use [Copy The Model Provider Smoke Agent](../core/docs/user/10-copy-sample-agent.md).

## Handler Test Example

`runAgentHandler` lets tests exercise the same envelope parsing and input validation path without spawning a child process.

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  createAgentArtifact,
  createAgentRunOutput,
  runAgentHandler,
  serializeAgentRunOutput
} from "@athena/pdk";

test("research runner output shape", async () => {
  const envelope = {
    task: {
      id: "task-1",
      inputs: {
        topic: "workspace notes"
      }
    },
    agent: {
      id: "local.research.plan",
      version: "0.1.0"
    },
    run: {
      id: "run-1"
    }
  };

  const result = await runAgentHandler(
    async ({ inputs, agent, run }) =>
      createAgentRunOutput(
        {
          agentId: agent.id,
          topic: inputs.topic,
          maxItems: inputs.maxItems
        },
        {
          artifacts: [
            createAgentArtifact({
              id: `research-plan-${run.id}`,
              label: "Research Plan",
              kind: "primary",
              format: "markdown",
              storageUri: `memory://local-research/${encodeURIComponent(run.id)}/plan.md`
            })
          ]
        }
      ),
    {
      envelope: JSON.stringify(envelope),
      inputContract: {
        topic: { type: "string", required: true },
        maxItems: { type: "integer", default: 3 }
      }
    }
  );

  assert.equal(result.output.topic, "workspace notes");
  assert.equal(result.output.maxItems, 3);
  assert.equal(result.artifacts[0].storageUri, "memory://local-research/run-1/plan.md");
  assert.equal(serializeAgentRunOutput(result), `${JSON.stringify(result)}\n`);
});
```

## Compatibility Boundaries

The Agent Developer Kit intentionally stays small:

- It validates task inputs against the current `agent.inputs` manifest field shape, but it does not generate manifests.
- It does not replace plugin package validation. Use `validatePluginPackage` from `@athena/core` or `npm --workspace @athena/core run validate:manifests` for package-level manifest checks.
- It builds the output envelope consumed by local-command, container-command, and HTTP/API task execution, but it does not write artifact payload files for you.
- It does not manage provider credentials, model calls, approvals, or runtime backend selection.
- Unknown additional properties are allowed where the runtime envelope is expected to evolve.
- Validation is additive and fail-closed for malformed required fields.

## API Reference

Current agent-authoring exports:

- `parseAgentTaskRunEnvelope(value: string | unknown): AgentTaskRunEnvelope`
- `parseAgentInputs(contract, inputs): Record<string, unknown>`
- `parseAgentEnvelopeInputs(envelope, contract): Record<string, unknown>`
- `createAgentArtifact(artifact): AgentRunArtifact`
- `createAgentRunOutput(output, options): AgentRunOutputEnvelope`
- `serializeAgentRunOutput(envelope): string`
- `runAgentHandler(handler, options): Promise<AgentRunOutputEnvelope>`
- `AgentSdkValidationError`
- `AgentInputContract`
- `AgentTaskRunEnvelope`
- `AgentRunArtifact`
- `AgentRunOutputEnvelope`

## Compatibility Exports

These exports support older specialist/persona code paths and local tests. They are retained for compatibility, but they are not the first-stop API for new plugin-backed agents:

- `definePersona(definition: PersonaDefinition): PersonaDefinition`
- `defineSpecialist(definition: PersonaDefinition): PersonaDefinition`
- `SPECIALISTS_DIRNAME` / `SPECIALIST_MANIFEST_FILENAME`
- `isValidPersonaName(name: string): boolean`
- `assertValidPersonaName(name: string): void`
- `new MockRuntime({ responses | resolveResponse })`
- `new MockFileStateStore({ files })`
- `new MockGitService({ diff, changedFiles })`
- `new PersonaTestHarness({ persona, runtime, fileStateStore, gitService, ... })`

## Validate Changes

```bash
npm --workspace @athena/pdk run typecheck
npm --workspace @athena/pdk run test
```
