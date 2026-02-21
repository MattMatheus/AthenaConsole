# Basic Usage

The primary way to interact with Project Athena is through the `athena` command-line interface (CLI).

## The `athena` Command

The `athena` executable is the main entry point for all operations. After building the project, you can invoke it using `npm run athena` to ensure you are using the local version.

```bash
npm run athena -- <command> [options]
```

## Running a Persona

The most common task is to run a "Persona." Personas are pre-configured agent personalities. The project includes a set of default personas in the `personas/` directory.

To run a persona, use the `persona run` command and specify the name of the persona.

```bash
npm run athena -- persona run --name <persona_name>
```

For example, to run the `code-review` persona (if available):

```bash
npm run athena -- persona run --name code-review
```

## Scaffolding a Persona

Create a new persona scaffold with:

```bash
npm run athena -- persona init <persona_name>
```

Then validate it:

```bash
npm run athena -- persona validate <persona_name>
```

### Run Artifacts

When a persona is run, Project Athena creates a unique run ID and stores all artifacts associated with that run in a dedicated directory. These artifacts provide a complete record of the session for later review and debugging.

You can find the artifacts under the `.athena/` directory in your project root:

```
.athena/
└── persona-runs/
    └── <runId>/
        ├─── transcript.jsonl
        └─── ...other artifacts
```

-   **`transcript.jsonl`**: A structured log of every turn in the conversation, including prompts, tool calls, and model outputs.
