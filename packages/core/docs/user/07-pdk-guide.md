# Persona Development Kit (PDK) Guide

The Athena Persona Development Kit (`@projectathena/pdk`) provides a set of tools and libraries to help you build, test, and validate custom personas.

## Overview

The PDK allows you to define personas with full TypeScript type safety, ensuring that your persona definitions are valid and compatible with the Athena runtime. It also includes a testing harness to verify your persona's behavior in a controlled environment.

## Key Features

- **Typed Persona Definitions**: Use `definePersona` and `PersonaDefinition` for type-safe authoring.
- **Scaffolding**: Quickly create new persona structures using the CLI.
- **Validation**: Ensure your `persona.json` or JS/TS definitions meet the required schema.
- **Unit Testing**: Test your persona's prompt assembly and output parsing using the `PersonaTestHarness`.
- **Mocking**: Includes `MockRuntime`, `MockFileStateStore`, and `MockGitService` for deterministic testing.

## Getting Started

### 1. Scaffolding a New Persona

Use the Athena CLI to create a new persona scaffold:

```bash
npm run athena -- persona init my-custom-persona
```

This will create a `personas/my-custom-persona.json` file and a `personas/my-custom-persona/` directory for your prompts, skills, and docs.

### 2. Defining a Persona (TypeScript)

If you prefer to define your persona in TypeScript (e.g., for complex logic or better IDE support), you can use the PDK:

```ts
import { definePersona, type PersonaDefinition } from "@projectathena/pdk";

export const persona = definePersona({
  schemaVersion: 1,
  id: "my-custom-persona",
  description: "A custom persona for specific tasks.",
  context: {
    promptFiles: ["prompt.md"],
    skillFiles: ["skills.md"],
    docFiles: ["docs.md"],
    maxFileChars: 20_000,
    maxTotalChars: 120_000
  }
} satisfies PersonaDefinition);
```

### 3. Validating Your Persona

You can validate your persona definition using the CLI:

```bash
npm run athena -- persona validate my-custom-persona
```

## Testing Your Persona

Testing is crucial for ensuring your persona behaves as expected. The PDK provides a `PersonaTestHarness` for this purpose.

### Example Test (using Vitest)

```ts
import {
  MockFileStateStore,
  MockGitService,
  MockRuntime,
  PersonaTestHarness,
  definePersona
} from "@projectathena/pdk";
import { describe, it, expect } from "vitest";

const myPersona = definePersona({
  schemaVersion: 1,
  id: "test-persona",
  context: {
    promptFiles: ["prompt.md"]
  }
});

describe("My Custom Persona", () => {
  it("should assemble the correct prompt", async () => {
    const runtime = new MockRuntime({
      resolveResponse: () => JSON.stringify({ ok: true })
    });

    const harness = new PersonaTestHarness({
      persona: myPersona,
      runtime,
      fileStateStore: new MockFileStateStore({
        files: { "prompt.md": "You are a helpful assistant." }
      })
    });

    const result = await harness.run();
    expect(result.prompt).toContain("You are a helpful assistant.");
  });
});
```

## PDK API Reference

### `definePersona(definition: PersonaDefinition): PersonaDefinition`
A helper function that provides type safety and basic validation for persona definitions.

### `PersonaTestHarness`
The main entry point for running persona unit tests. It coordinates the mock services and the persona execution logic.

### `MockRuntime`
Simulates the LLM runtime. You can provide predefined responses or a resolver function to handle different prompts.

### `MockFileStateStore`
Simulates the filesystem. Use it to provide content for `promptFiles`, `skillFiles`, and `docFiles` without creating actual files on disk.

### `MockGitService`
Simulates Git operations, allowing you to test personas that rely on diffs or changed files.
