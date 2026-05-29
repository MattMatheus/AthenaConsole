# @athena/pdk

Typed development kit for Team Orchestrator plugin and agent authors.

## Scope

This package provides:

- Agent task/run envelope parsing (`parseAgentTaskRunEnvelope`)
- Manifest-shaped agent input validation (`parseAgentInputs`, `parseAgentEnvelopeInputs`)
- Agent run output and artifact builders (`createAgentRunOutput`, `createAgentArtifact`)
- Minimal agent handler test helper (`runAgentHandler`)
- Stable specialist authoring contracts (`PersonaDefinition`, `Context`, `Skill`)
- Typed specialist run input/output envelopes (`PersonaRunInput`, `PersonaRunOutput`)
- Runtime validation helper (`definePersona` / `defineSpecialist`) with deterministic error messages
- Local specialist unit-test harness (`PersonaTestHarness`) with deterministic `MockRuntime`

## Compatibility Boundaries

- Agent input validation intentionally follows the current `agent.inputs` manifest shape. It does not generate manifests or replace manifest validation.
- Agent output helpers produce the run envelope consumed by local-command, container-command, and HTTP/API task execution.
- `PersonaDefinition` is aligned to the current `specialists/<id>/manifest.json` runtime contract.
- Validation is additive and fail-closed for malformed required fields.
- Unknown additional properties are currently allowed for forward compatibility.

## Minimal Agent Example

```ts
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput,
  type AgentInputContract
} from "@athena/pdk";

const inputs = {
  topic: {
    type: "string",
    required: true,
    label: "Topic"
  },
  maxItems: {
    type: "integer",
    default: 5
  }
} satisfies AgentInputContract;

const stdin = await new Promise<string>((resolve, reject) => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    body += chunk;
  });
  process.stdin.on("end", () => resolve(body));
  process.stdin.on("error", reject);
});

const envelope = parseAgentTaskRunEnvelope(stdin);
const taskInputs = parseAgentEnvelopeInputs<{
  topic: string;
  maxItems: number;
}>(envelope, inputs);

const result = createAgentRunOutput(
  {
    summary: `Prepared research plan for ${taskInputs.topic}.`,
    maxItems: taskInputs.maxItems
  },
  {
    artifacts: [
      createAgentArtifact({
        label: "Research Plan",
        kind: "primary",
        format: "markdown",
        storageUri: "artifacts/research-plan.md"
      })
    ]
  }
);

process.stdout.write(serializeAgentRunOutput(result));
```

## Persona Usage

```ts
import { definePersona, type PersonaDefinition } from "@athena/pdk";

const persona = definePersona({
  schemaVersion: 1,
  id: "code-review",
  description: "Reviews git changes and emits structured findings.",
  context: {
    promptFiles: ["prompt.md"],
    skillFiles: ["skills.md"],
    docFiles: ["docs.md"],
    maxFileChars: 20_000,
    maxTotalChars: 120_000
  }
} satisfies PersonaDefinition);
```

## API

- `parseAgentTaskRunEnvelope(value: string | unknown): AgentTaskRunEnvelope`
- `parseAgentInputs(contract, inputs): Record<string, unknown>`
- `parseAgentEnvelopeInputs(envelope, contract): Record<string, unknown>`
- `createAgentArtifact(artifact): AgentRunArtifact`
- `createAgentRunOutput(output, options): AgentRunOutputEnvelope`
- `serializeAgentRunOutput(envelope): string`
- `runAgentHandler(handler, options): Promise<AgentRunOutputEnvelope>`
- `definePersona(definition: PersonaDefinition): PersonaDefinition`
- `defineSpecialist(definition: PersonaDefinition): PersonaDefinition`
- `SPECIALISTS_DIRNAME` / `SPECIALIST_MANIFEST_FILENAME`
- `isValidPersonaName(name: string): boolean`
- `assertValidPersonaName(name: string): void`
- `new MockRuntime({ responses | resolveResponse })`
- `new MockFileStateStore({ files })`
- `new MockGitService({ diff, changedFiles })`
- `new PersonaTestHarness({ persona, runtime, fileStateStore, gitService, ... })`

## Persona Harness Example (Vitest or Jest)

```ts
import {
  MockFileStateStore,
  MockGitService,
  MockRuntime,
  PersonaTestHarness,
  definePersona
} from "@athena/pdk";

const persona = definePersona({
  schemaVersion: 1,
  id: "code-review",
  context: {
    promptFiles: ["prompt.md"],
    skillFiles: ["skills.md"],
    docFiles: ["docs.md"]
  }
});

const runtime = new MockRuntime({
  resolveResponse: (request) =>
    request.metadata.trigger === "persona:run"
      ? JSON.stringify({
          schemaVersion: 1,
          mergeGate: "pass",
          reportMarkdown: "# ok",
          findings: []
        })
      : undefined
});

const harness = new PersonaTestHarness({
  persona,
  runtime,
  fileStateStore: new MockFileStateStore({
    files: {
      "prompt.md": "System prompt",
      "skills.md": "Skill list",
      "docs.md": "Doc context"
    }
  }),
  gitService: new MockGitService({
    changedFiles: ["src/a.ts"],
    diff: "diff --git a/src/a.ts b/src/a.ts"
  })
});

const result = await harness.run();
expect(result.contextPack.includedFiles).toEqual(["prompt.md", "skills.md", "docs.md"]);
expect(result.prompt).toContain("Changed files (bounded):");
expect(result.parsedOutput.parsed).toBe(true);
expect(result.runOutput.mergeGate).toBe("pass");
```

## Build

```bash
npm --workspace @athena/pdk run typecheck
npm --workspace @athena/pdk run test
```
