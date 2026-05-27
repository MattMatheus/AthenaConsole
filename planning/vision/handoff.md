<!-- AUDIENCE: Internal/Technical -->

# Handoff Summary

## Delivered

- Completed `planning/backlog/completed/2026.16.01-instantiate-workflow-templates.md`.
- Added the core workflow template instantiation contract and API route: `POST /api/v1/workflow-templates/:id/instantiate`.
- Extended workflow manifests with optional `workflow.inputs` definitions for required/defaulted template inputs.
- Implemented local instantiation from indexed workflow templates into a mission plus ordered task records.
- Resolved supplied/default input values into mission context and rendered task inputs while preserving typed values for JSON inputs.
- Remapped template task dependencies to created task ids and added workflow-template provenance on generated tasks.
- Returned the source template identity, created mission, created tasks, and resolved input values from the API.
- Promoted `planning/backlog/active/2026.16.02-build-workflow-template-instantiation-ui.md` as the next story.

## Validation

- Pass: `npm --workspace @athena/core run typecheck`
- Pass: `npm --workspace @athena/core exec vitest run tests/control-plane.workflow-template-instantiation.test.ts tests/api.workflow-template-catalog.test.ts tests/control-plane.api-contracts.test.ts tests/api.route-registration.test.ts tests/api.schemas.test.ts`
- Pass: `npm --workspace @athena/core run test:unit`
- Pass: `npm --workspace @athena/core run generate:schemas`
- Pass: `npm --workspace @athena/core run validate:manifests`
- Pass: `git diff --check`

## Next Work

- Execute `planning/backlog/active/2026.16.02-build-workflow-template-instantiation-ui.md`.
- Start from the workflow template catalog console surface and the new core instantiation API.
- The UI may need catalog metadata to expose `workflow.inputs`; add it to the catalog summary if the current metadata is insufficient.
- Keep workflow-template editing, scheduling, plugin installation, and full DAG execution out of the next slice.
