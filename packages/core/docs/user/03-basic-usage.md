# Basic Usage

The primary current workflow is through the Team Orchestrator console. This page covers the core runtime compatibility CLI, exposed through the historical `athena` command.

## The `athena` Command

The `athena` executable is the main entry point for all operations. After building the project, you can invoke it using `npm run athena` to ensure you are using the local version.

```bash
npm run athena -- <command> [options]
```

## Running a Plugin Agent

The current workflow is to load a plugin-backed agent, create a task with inputs that match the agent manifest, and run that task.

For example, the checked-in code-review sample lives at `sample-plugins/code-review` and exposes agent id `code.review.local`.

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{"id":"task-code-review","title":"Review current branch","status":"ready","capabilityRequirements":["code.review"],"assignedAgentId":"code.review.local","assignedAgentVersion":"0.1.0","inputs":{"repo":{"path":"."},"baseRef":"main","headRef":"HEAD"}}'

curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-code-review/run \
  -H "content-type: application/json" \
  -d '{}'
```

## Scaffolding an Agent

Create a new plugin-backed agent scaffold with:

```bash
npm run athena -- agent scaffold --name "Research Planner"
```

The command generates a plugin manifest, an agent manifest, a runner, and a README in the configured plugin directory.

### Run Artifacts

When a task runs, Team Orchestrator creates a unique run ID and stores artifact metadata for later review and debugging.

Inspect artifacts through the task-run API:

```bash
curl http://127.0.0.1:8787/api/v1/task-runs/<run-id>
```

Artifact records include label, kind, format, storage URI, and agent-provided metadata.
