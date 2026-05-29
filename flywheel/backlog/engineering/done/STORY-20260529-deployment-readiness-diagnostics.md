---
kind: story
id: STORY-20260529-deployment-readiness-diagnostics
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can see whether a local-server deployment is ready to run real work.
release_scope: next
ready: true
---

# Story: Deployment Readiness Diagnostics

## Metadata
- `id`: STORY-20260529-deployment-readiness-diagnostics
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0018]
- `epic`: docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: Operators can see whether a local-server deployment is ready to run real work.
- `release_scope`: next

## Problem Statement

Server deployment needs visible readiness checks for storage, repos, plugins, providers, and runtimes.

## Initial Scope

- In: readiness checks for app-state, artifact storage, managed repo root, plugin paths, secret root/provider status, runtime backend, server exposure warnings, console display.
- Out: external monitoring stack, internet production posture.

## Acceptance Criteria

1. Readiness API reports server storage/resource checks without exposing secrets.
2. Console readiness surface shows pass/warn/fail for local-server requirements.
3. Diagnostics include actionable next steps.
4. Existing first-run readiness remains intact.
5. Server exposure warnings are clear when configuration is not LAN-safe.

## Validation

- Core readiness tests.
- Console typecheck/lint.
- Browser QA for diagnostics surface.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Build on existing readiness services rather than creating a separate diagnostics system.

## Engineering Handoff

- `change_summary`: Expanded `/api/v1/readiness` with deployment checks for artifact storage, managed repo root, plugin paths, secret root, saved model providers, and server exposure; added shared readiness categories and rendered a dashboard checklist with pass/warn/fail badges and next steps.
- `validation_evidence`: `npm --workspace @athena/core run test:unit -- --run tests/control-plane.readiness.test.ts tests/api.server.test.ts tests/api.schemas.test.ts`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run check:schemas`; `npm --workspace apps/console run test -- --run src/features/readiness/api.test.ts`; `npm --workspace apps/console run typecheck`; `npm --workspace apps/console run lint`; readiness API curl smoke; headless Chrome dashboard DOM smoke; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `qa_focus`: Confirm readiness output does not expose secret values or secret-shaped keys, server exposure warnings distinguish loopback/auth/unauthenticated external posture, and the console dashboard shows actionable pass/warn/fail diagnostics for local-server operation.
- `open_risks`: Container-level compose smoke remains environment-dependent because Docker is unavailable locally; local-file secret root will correctly warn in ordinary laptop dev unless mounted.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Focused unit/API/schema coverage passed for readiness contracts and secret scrubbing, console parser/typecheck/lint passed, `/api/v1/readiness` curl smoke returned the expanded deployment check list without secret-shaped leaks, and headless Chrome dashboard DOM smoke confirmed the pass/warn checklist with actionable next steps.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T21:42:54Z`: `ready` -> `active`; Engineering starts deployment readiness diagnostics
- `2026-05-29T21:52:55Z`: `active` -> `qa`; Engineering handoff ready for deployment readiness diagnostics QA
- `2026-05-29T21:53:37Z`: `qa` -> `done`; QA passed deployment readiness diagnostics
