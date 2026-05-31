# Repo Summary Plugin

This sample plugin provides a read-only local agent that summarizes a repository without requiring a model provider.

The agent accepts structured task input under `inputs.repo`:

```json
{
  "repo": {
    "path": "/absolute/path/to/repository"
  },
  "maxFiles": 200
}
```

It scans file names and a short README excerpt, skips common generated directories such as `.git`, `node_modules`, `dist`, and `coverage`, then emits a deterministic markdown summary artifact.

When you select a connected repository in the console, Team Orchestrator populates this same runtime contract from the repository record. Tasks may also carry `repo.workspacePath` and top-level `repoPath` for compatibility, but sample runners receive `repo.path`.

## Resources

- Plugin id: `team-orchestrator.samples.repo-summary`
- Agent id: `repo.summary.local`
- Capabilities: `repo.inspect`, `repo.summarize`, `artifacts.produce`
- Runtime backend: `local-process`

## Run Against A Connected Repo

After starting the local API from the repository root, confirm the agent appears in the catalog:

```bash
curl "http://127.0.0.1:8787/api/v1/agent-catalog/agents?capabilities=repo.summarize"
```

Create a ready task that points at the local repository you connected or cloned:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{
    "id": "task-repo-summary",
    "title": "Summarize repository",
    "status": "ready",
    "capabilityRequirements": ["repo.summarize"],
    "assignedAgentId": "repo.summary.local",
    "assignedAgentVersion": "0.1.0",
    "inputs": {
      "repo": {
        "path": "/absolute/path/to/repository"
      },
      "maxFiles": 200
    }
  }'
```

Run it and inspect the run:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-repo-summary/run -H "content-type: application/json" -d '{}'
curl http://127.0.0.1:8787/api/v1/task-runs/<run-id>
```

Successful execution returns `status: "completed"` and a `Repo summary` markdown artifact. The output is deterministic and local, so it works before model provider credentials are configured.
