<!-- AUDIENCE: Internal/Technical -->

# Active Backlog

The active queue has resumed after completing the Team Orchestrator foundation reset implementation.

Every story in this queue is derived from the accepted reset ADRs:

- `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md`
- `planning/architecture/0007-agent-manifest-and-lifecycle-contract.md`
- `planning/architecture/0008-plugin-package-format.md`
- `planning/architecture/0009-task-mission-run-domain-model.md`
- `planning/architecture/0010-sqlite-app-state-architecture.md`
- `planning/architecture/0011-runtime-backend-interface.md`
- `planning/architecture/0012-event-artifact-observability-model.md`
- `planning/architecture/0013-safety-approval-and-loop-limit-model.md`
- `planning/architecture/0014-scheduling-model.md`

## Completed Foundation Reset

Completed stories were moved to:

- `planning/backlog/completed/2026-product-direction-reset/`
- `planning/backlog/completed/2026.11.01-add-agent-catalog-api.md`
- `planning/backlog/completed/2026.11.02-build-agent-catalog-page.md`
- `planning/backlog/completed/2026.11.03-build-agent-detail-page.md`
- `planning/backlog/completed/2026.12.01-add-task-apis.md`
- `planning/backlog/completed/2026.12.02-build-manual-task-create-flow.md`
- `planning/backlog/completed/2026.12.03-implement-local-process-task-runs.md`
- `planning/backlog/completed/2026.12.04-build-run-inspection-view.md`
- `planning/backlog/completed/2026.13.01-add-container-command-backend.md`
- `planning/backlog/completed/2026.13.02-add-http-api-backend-prototype.md`
- `planning/backlog/completed/2026.13.03-enforce-approval-and-limit-defaults.md`
- `planning/backlog/completed/2026.14.01-add-mission-apis.md`
- `planning/backlog/completed/2026.14.02-add-workflow-template-indexing.md`
- `planning/backlog/completed/2026.14.03-run-sequential-mission-plans.md`
- `planning/backlog/completed/2026.15.01-add-task-schedule-model-and-api.md`
- `planning/backlog/completed/2026.15.02-add-local-scheduler-service.md`
- `planning/backlog/completed/2026.15.03-build-schedule-ui.md`
- `planning/backlog/completed/2026.16.01-instantiate-workflow-templates.md`
- `planning/backlog/completed/2026.16.02-build-workflow-template-instantiation-ui.md`
- `planning/backlog/completed/2026.16.03-build-mission-workbench-ui.md`
- `planning/backlog/completed/2026.16.04-add-mission-run-history.md`
- `planning/backlog/completed/2026.16.05-schedule-workflow-templates.md`
- `planning/backlog/completed/2026.16.06-add-durable-schedule-run-history.md`

## Active Queue

1. `planning/backlog/active/2026.17.01-implement-workflow-dag-definition-parser.md`

The next slice starts the workflow DAG engine by parsing and validating workflow-template task dependencies while preserving existing sequential workflow behavior.

## Archived Previous Queue

The stale fleet-dashboard queue was archived to:

- `planning/archive/2026-product-direction-reset/active-backlog-snapshot/`

Do not promote legacy fleet governance or Athena-centered persona work back into active execution without reframing it against the reset baseline.
