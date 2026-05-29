# First-Run Demo Plugin

This local sample plugin provides a small two-step workflow template for first-run validation.

The workflow uses the canonical workflow DAG path and a local-process demo agent. Each step emits stable JSON output and artifact metadata so operators can inspect run status, events, and artifacts without external credentials.

## Resources

- Plugin id: `team-orchestrator.samples.first-run`
- Agent id: `first-run.demo.local`
- Workflow template id: `first-run.demo.workflow`
- Workflow steps: `prepare`, then `verify`

## Run From The Local API

After starting the local stack from the repository root:

```bash
curl "http://127.0.0.1:8787/api/v1/workflow-templates?pluginId=team-orchestrator.samples.first-run"
curl -X POST http://127.0.0.1:8787/api/v1/workflow-templates/first-run.demo.workflow/instantiate \
  -H "content-type: application/json" \
  -d '{"missionId":"mission-first-run-demo","taskIdPrefix":"first-run-demo","inputs":{"demoName":"First-Run Demo"}}'
curl -X POST http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/execute
curl http://127.0.0.1:8787/api/v1/workflow-runs/workflow-run-mission-first-run-demo/status
```

Successful execution returns `status: "completed"` with `executedStepIds` containing `prepare` and `verify`. The status response reports two completed steps and includes local demo evidence messages, for example `First-Run Demo: prepare completed locally.`

## From Demo To Real Repo Work

This plugin is intentionally deterministic. It proves that local plugin discovery, agent execution, workflow DAG status, events, and artifact metadata work without external credentials.

For real repository work, add or configure plugin packages that provide agents for your target repo. Then expose the repo path through local configuration or run inputs, refresh the agent catalog, and start a task or workflow with that repo as run context.

The console does not author agents or save repository records today. Use Resource Controls for repo wiring guidance and Agents to confirm which plugin-backed capabilities are available.

See [Getting Started](../../../GETTING_STARTED.md) for the full first-run walkthrough.
