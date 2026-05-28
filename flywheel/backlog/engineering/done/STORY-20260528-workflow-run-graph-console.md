---
kind: story
id: STORY-20260528-workflow-run-graph-console
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can inspect real workflow-template DAG runs from the console.
release_scope: follow-up
ready: true
---

# Story: Add Console Workflow Run Graph Inspection

## Metadata
- `id`: STORY-20260528-workflow-run-graph-console
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0015, ADR-0012]
- `epic`: docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md
- `success_metric`: Operators can inspect real workflow-template DAG runs from the console.
- `release_scope`: follow-up

## Problem Statement

The API can expose graph-friendly workflow status, but operators need a console path from workflow-template instantiation and schedule history into real DAG run inspection.

## Scope

- In: console links from workflow-template instantiation results and schedule run history to workflow DAG run status, a hybrid dependency summary plus dependency-aware step table, polling/terminal state handling, failure/recovery display, focused UI/API tests.
- Out: visual workflow editor, drag/drop graph authoring, hosted scheduler UI, new workflow status API response fields.

## Acceptance Criteria

1. Instantiation and schedule history surfaces expose navigation to the workflow DAG run.
2. Console displays DAG steps, dependencies, readiness, status, failures, and recovery metadata.
3. Polling respects the status API recommended interval and stops on terminal states.
4. Existing mission/task details remain available and are not obscured by the graph view.
5. Empty/loading/error states are clear.
6. Console validation covers at least one real workflow-template DAG run.

## Validation

- Required checks: relevant console package typecheck/test scripts after inspecting package scripts; core API tests if response use changes.
- Additional checks: browser or Playwright verification if the local console can be run in this environment.

## Dependencies

- Recommended after `STORY-20260528-workflow-dag-step-task-run-linking`.
- Stronger after `STORY-20260528-workflow-template-schedule-dag-execution`.

## Risks

- UI may overfit seeded graph data; tests should use real workflow-template run responses.
- Layout needs to remain useful for both small sequential templates and branched DAGs.

## Refinement

- Decision: first UI is a hybrid view.
- Rationale: operators need fast dependency inspection and terminal/recovery detail now; a full interactive graph can wait until graph authoring or large DAG ergonomics justify a graph library.
- UX shape: link into `/workflows/runs/:runId`, show run/progress/recovery summary, show edges as compact dependency chips, and make step rows the primary inspection surface.
- Polling: use the status API `polling.recommendedIntervalMs` while the run is pending, running, or resumable, and stop automatic polling when completed or failed.
- Open questions resolved: no API response shape changes; existing mission and task links remain visible beside workflow-run links.

## Engineering Handoff
- `change_summary`: Added a console workflow-run status feature module, `/workflows/runs/:runId` detail route, hybrid dependency summary plus step table, recommended-interval polling, recovery/failure/event displays, workflow-run links from workflow-template instantiation results, and workflow-run links from schedule run results/history.
- `validation_evidence`: `npm run test --workspace @athena/console` passed; `npm run typecheck --workspace @athena/console` passed; `npm run build --workspace @athena/console` passed; `npm run lint --workspace @athena/console` passed; `git diff --check` passed; `./flywheel/tools/validate_workflow_state.sh` passed. Browser/Playwright visual verification was not run because Playwright/Puppeteer are not installed in this workspace and no browser automation tool is exposed in this session.
- `qa_focus`: Verify links preserve mission/task navigation while adding workflow-run navigation; verify polling stops for completed/failed runs and uses `polling.recommendedIntervalMs` for non-terminal runs; inspect empty/loading/error state behavior for missing run ids and API failures.
- `open_risks`: Visual QA is limited to build/static checks in this environment; a live API-backed browser pass should be done when a seeded workflow DAG run is available.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Good for static and automated console validation. QA reran `npm run test --workspace @athena/console`, `npm run typecheck --workspace @athena/console`, `npm run lint --workspace @athena/console`, `npm run build --workspace @athena/console`, `git diff --check`, and `./flywheel/tools/validate_workflow_state.sh`; all passed. Vite dev server also returned HTTP 200 for `/workflows/runs/workflow-dag-run-1`. Full browser visual QA remains deferred because no Playwright/Puppeteer package or browser automation tool is available in this session.
- `defects`: None found.
- `state_transition`: Move `engineering/qa` -> `engineering/done`.

## Transition History
- `2026-05-28T19:46:47Z`: `intake` -> `active`; PM refined as hybrid workflow DAG run inspection console story
- `2026-05-28T19:52:50Z`: `active` -> `qa`; Engineering complete with console workflow DAG run inspection and validation evidence
- `2026-05-28T19:53:49Z`: `qa` -> `done`; QA passed automated console validation for workflow DAG run inspection
