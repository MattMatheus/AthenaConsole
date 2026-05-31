# Code Review Sample Agent

Read-only local plugin for reviewing a git diff with deterministic checks.

- Plugin id: `team-orchestrator.samples.code-review`
- Agent id: `code.review.local`
- Capability: `code.review`
- Runtime backend: `local-process`
- Network: denied
- Filesystem: scoped

## Review Behavior

This sample carries forward the useful parts of the old code-review specialist as a current plugin-backed agent:

- Review the diff between `baseRef` and `headRef`.
- Prioritize correctness, security, data-safety, performance, maintainability, and test gaps.
- Emit concrete findings with `P1`, `P2`, or `P3` priority.
- Keep behavior deterministic, bounded, and read-only.
- Return a markdown report artifact through the current task-run artifact contract.

The legacy specialist asset is not part of the current authoring path. New code-review behavior should be added here or in another plugin-backed agent.

## Run It

Create a ready task:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{
    "id": "task-code-review",
    "title": "Review current branch",
    "status": "ready",
    "capabilityRequirements": ["code.review"],
    "assignedAgentId": "code.review.local",
    "assignedAgentVersion": "0.1.0",
    "inputs": {
      "repo": { "path": "/path/to/repo" },
      "baseRef": "main",
      "headRef": "HEAD"
    }
  }'
```

Run it:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-code-review/run \
  -H "content-type: application/json" \
  -d '{}'
```

Inspect the returned run id:

```bash
curl "http://127.0.0.1:8787/api/v1/task-runs/<run-id>"
```
