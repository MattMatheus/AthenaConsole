---
kind: story
id: STORY-20260529-agent-provider-readiness
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can see whether an agent or workflow has the provider configuration required to run.
release_scope: next
ready: true
---

# Story: Agent Provider Readiness

## Metadata
- `id`: STORY-20260529-agent-provider-readiness
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md
- `success_metric`: Operators can see whether an agent or workflow has the provider configuration required to run.
- `release_scope`: next

## Problem Statement

Even after provider setup exists, operators need to know whether a selected agent/workflow can actually use a configured provider.

## Initial Scope

- In: manifest provider requirement conventions, readiness service, agent/workflow UI readiness copy, create-work missing-provider states.
- Out: full structured form rendering, SDK provider proxy.

## Acceptance Criteria

1. Agents/workflows can declare provider/model requirements or preferences in a documented manifest-compatible way.
2. Readiness checks report configured, missing, invalid, or untested provider status.
3. Agent catalog and workflow create paths show missing provider setup before run.
4. No raw provider secret values appear in readiness payloads or UI.
5. Mock provider remains available for local-only demos.

## Validation

- Core tests for provider readiness evaluation.
- `npm --workspace @athena/core run validate:manifests`
- `npm --workspace apps/console run typecheck`
- `npm --workspace apps/console run lint`
- Browser QA for missing and ready provider states.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Keep provider requirements minimal and compatible with current manifest schema conventions.

## Engineering Handoff

- `completed_at`: 2026-05-29T20:09:57Z
- `change_summary`: Added manifest-compatible provider requirement conventions, provider readiness evaluation for agent and workflow catalog summaries, readiness display in agent catalog/detail/task/workflow create paths, and ready-state blocking copy for missing or invalid required providers.
- `validation_evidence`: core typecheck, console typecheck/lint, focused core/API provider readiness tests, focused console tests, manifest validation, schema check, whitespace check, and Flywheel workflow validation passed.
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace apps/console run typecheck`
  - `npm --workspace apps/console run lint`
  - `npm --workspace @athena/core exec -- vitest run tests/control-plane.agent-catalog.test.ts tests/api.agent-catalog.test.ts tests/control-plane.workflow-template-catalog.test.ts tests/api.workflow-template-catalog.test.ts tests/api.schemas.test.ts tests/control-plane.manifests.test.ts tests/control-plane.readiness.test.ts`
  - `npm --workspace apps/console run test -- src/features/agent-catalog src/features/workflow-templates src/features/task-workbench/formModel.test.ts`
  - `npm --workspace @athena/core run validate:manifests`
  - `npm --workspace @athena/core run check:schemas`
  - `git diff --check`
  - `./flywheel/tools/validate_workflow_state.sh`
- `qa_focus`: Browser QA still needs to verify missing and ready provider states on the agent catalog, agent detail, task create, and workflow instantiate surfaces; the in-app Browser backend was unavailable during engineering handoff, and Chrome should only be launched with operator permission.
- `open_risks`: Local dev API currently has no indexed agents/workflows, so browser QA should use seeded provider/manifest state or a configured plugin index to prove visible missing/ready states. Mock/local-only demos remain non-blocking when no provider requirement is declared.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:29:30Z
- `evidence_quality`: Fresh QA covered provider readiness unit/API tests, console typecheck/lint, browser verification of missing and configured provider states with a disposable plugin/workspace, secret-value non-disclosure checks, and workflow validation.
- `acceptance_coverage`:
  - AC1: Temporary QA manifests declared `runtime.modelProvider` on an agent and `workflow.providerRequirements` on a workflow using the documented provider requirement shape.
  - AC2: API payloads reported `missing` before provider config existed and `configured` after creating `openai-main`; existing tests cover `invalid` and `untested` paths.
  - AC3: Firefox QA verified agent catalog, agent detail, task create, and workflow instantiate surfaces showed missing provider setup before configuration and configured provider state after setup.
  - AC4: API QA confirmed readiness payloads did not contain the fake secret value `not-a-real-key`; UI displayed provider id/name/status only.
  - AC5: Browser QA with local-only sample agents still showed no provider requirement for mock/local demos during the repo-summary story QA, and provider-readiness tests preserve no-provider/untested behavior.
- `validation_evidence`: `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; `npm --workspace @athena/core exec -- vitest run tests/control-plane.agent-catalog.test.ts tests/api.agent-catalog.test.ts tests/control-plane.workflow-template-catalog.test.ts tests/api.workflow-template-catalog.test.ts tests/api.schemas.test.ts tests/control-plane.manifests.test.ts tests/control-plane.readiness.test.ts`; browser QA at `http://127.0.0.1:5173/agents`, `/agents/qa.provider.agent?version=0.1.0`, `/tasks?agentId=qa.provider.agent&version=0.1.0`, and `/workflows`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `defects`: None found.
- `state_transition`: Move to `done`.
- `notes`: QA used `/tmp/athena-provider-qa-*` disposable plugin/workspace and removed it afterward. Firefox was left running; local API and Vite servers were stopped.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T19:58:35Z`: `ready` -> `active`; Engineering starts agent provider readiness
- `2026-05-29T20:10:13Z`: `active` -> `qa`; Engineering handoff ready; browser QA pending
- `2026-05-29T20:29:07Z`: `qa` -> `done`; QA passed for agent provider readiness
