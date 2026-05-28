<!-- AUDIENCE: Internal/Product -->

# Code Quality Audit Findings

Date: 2026-05-28

Scope: Team Orchestrator repository audit for PM breakdown. This is a read-only code review artifact, not a Flywheel implementation handoff.

Review frame: adversarial maintainability audit covering architecture, debt landmines, simplification opportunities, operational risk, and future scaling cliffs.

## Executive Summary

The codebase has a strong test culture and the current Team Orchestrator direction is visible in the source, but several foundational seams are carrying too much risk:

- The production-like Docker stack exposes API routes while authentication and authorization default to off.
- The new SQLite workflow DAG state store is not wired into workflow-template instantiation, scheduling, or actual execution.
- Task and mission runs persist `running` states without restart recovery.
- The product has two active persistence models: legacy file state and SQLite app state.
- Several repository list APIs read entire tables and filter in memory.
- Current product/Flywheel docs point at completed or moved work.
- Core service files are large enough that future changes will be slow and regression-prone.

Maintainability score: Needs Work. The foundation is coherent, but important runtime and planning contracts are split across parallel implementations.

## Critical Findings

### CR-1 Production-like stack exposes unauthenticated control APIs

Why it matters: The local-first product can run commands, create schedules, inspect runs, and mutate orchestration state. In the production-like stack, the API container binds to `0.0.0.0` and publishes port `8787`, while core auth and authz default to disabled/allow. The console password gate is client-only and is not configured in the production compose file.

Evidence:

- `docker-compose.prod.yml:6` publishes the API with `ATHENA_DEV_API_HOST: 0.0.0.0`, and `docker-compose.prod.yml:16` publishes `"8787:8787"`.
- `packages/core/src/shared/config.ts:234` defaults `auth.enabled` to `false`; `packages/core/src/shared/config.ts:240` defaults `authz.mode` to `off` and `authz.defaultDecision` to `allow`.
- `apps/console/src/App.tsx:9` reads `VITE_CONSOLE_PASSWORD`, and `apps/console/src/App.tsx:37` stores success in `sessionStorage`.
- `packages/core/infrastructure/docker/console.nginx.prod.conf:5` proxies `/api/` without adding identity or auth enforcement.
- `apps/console/src/services/apiClient.ts:28` starts API fetches without identity/auth headers.

PM story slices:

1. Require explicit auth posture for production-like compose.
2. Add server-side API auth for console/API access, not only a client-side gate.
3. Fail startup when API binds externally with auth disabled unless an explicit local-dev override is set.
4. Add docs for local-only, LAN, and production-like security modes.

Suggested validation:

- Compose smoke test proves unauthenticated `/api/v1/health` behavior matches the selected mode.
- API route tests cover auth-disabled local mode, auth-required production-like mode, and missing identity rejection.
- Console API client tests cover required identity/auth header injection.

## High Findings

### H-1 Workflow DAG state is durable but not wired into execution

Why it matters: The roadmap goal is restart-safe DAG-capable workflow execution, but the live workflow-template path still instantiates sequential mission/tasks. The new `LocalWorkflowStateService` creates and mutates `workflow_dag_runs`, while `LocalWorkflowTemplateCatalogService.instantiate` creates a mission and tasks without creating a workflow DAG run. The API exposes graph status for workflow DAG runs, but ordinary workflow-template execution does not appear to create those runs.

Evidence:

- `docs/product/direction/current-direction.md:50` says the roadmap goal is restart-safe DAG-capable workflow execution.
- `packages/core/src/control-plane/services/workflow-state.ts:26` owns DAG run creation; `packages/core/src/control-plane/services/workflow-state.ts:60` starts steps; `packages/core/src/control-plane/services/workflow-state.ts:89` completes steps; `packages/core/src/control-plane/services/workflow-state.ts:135` recovers stale running steps.
- `packages/core/src/control-plane/services/workflow-template-catalog.ts:84` instantiates a workflow template into a mission and ordered tasks, but the method returns only template, mission, tasks, and inputs at `packages/core/src/control-plane/services/workflow-template-catalog.ts:168`.
- `packages/core/src/api/routes/workflow-routes.ts:11` exposes `/api/v1/workflow-runs/:runId/status`, but repository search shows `LocalWorkflowStateService` usage is limited to tests and the workflow status service path.

PM story slices:

1. Define the canonical workflow execution path: legacy file workflow executor, mission/task orchestration, or SQLite DAG runs.
2. Create a workflow DAG run during template instantiation or schedule execution.
3. Attach task run IDs/artifacts/events to DAG step records.
4. Expose DAG run IDs in the console and schedule run history.
5. Retire or clearly label legacy workflow run APIs if they remain separate.

Suggested validation:

- Integration test: instantiate workflow template, run it, then fetch `/api/v1/workflow-runs/:runId/status`.
- Restart simulation test: mark a DAG step running, reopen app state, recover stale step, resume.
- UI test: workflow run graph loads from a real workflow-template run, not a hand-seeded test run.

### H-2 Task and mission runs can remain stuck as `running` after process death

Why it matters: Task runs update SQLite state to `running` before spawning a process or calling HTTP, and missions update to `running` before running child tasks. If the API process dies mid-run, there is no startup reconciliation comparable to the new workflow DAG stale-step recovery. Operators will see stale running tasks/missions and schedules may skip or misclassify follow-up work.

Evidence:

- `packages/core/src/control-plane/services/task-workbench.ts:309` creates a run with `status: "running"` and `packages/core/src/control-plane/services/task-workbench.ts:319` updates the task to `running` before process execution.
- `packages/core/src/control-plane/services/mission-workbench.ts:144` creates a mission run with `status: "running"` and `packages/core/src/control-plane/services/mission-workbench.ts:155` updates the mission to `running`.
- `packages/core/src/control-plane/services/task-workbench.ts:358` stores active task runs in an in-memory map, and `packages/core/src/control-plane/services/task-workbench.ts:613` cancellation depends on that map.
- `packages/core/src/control-plane/services/workflow-state.ts:135` has stale-running recovery for workflow steps, but equivalent task/mission recovery is not present in the task or mission services.

PM story slices:

1. Add persisted leases or heartbeat timestamps to app-state task and mission runs.
2. Reconcile stale `running` task/mission runs on API startup.
3. Record recovery events so the console can explain why a run became failed/resumable.
4. Decide whether schedules retry, pause, or mark error when a target was recovered from stale running.

Suggested validation:

- Unit test: create running task/mission state, reopen app state, recovery marks it failed/resumable with an event.
- Schedule test: stale target does not permanently block future scheduled attempts.

### H-3 Two persistence models are active and ownership is unclear

Why it matters: The product direction says SQLite is the local app-state store for v1, but the service graph still creates a `FileStateStore` for sessions, directives, harness profiles, run templates, legacy workflows, schedule manager state, and work queues, while newer app-state repositories own plugins, agents, tasks, missions, runs, events, artifacts, schedules, and workflow DAG runs. This means operators and PMs cannot assume one durable source of truth.

Evidence:

- `packages/core/src/control-plane/services.ts:181` creates `new FileStateStore(options.config)` and `packages/core/src/control-plane/services.ts:218` through `packages/core/src/control-plane/services.ts:244` wires it to session, directive, run-template, workflow, and harness-profile services.
- `packages/core/src/control-plane/app-state/database.ts:24` defines the SQLite database filename, and `packages/core/src/control-plane/app-state/database.ts:73` through `packages/core/src/control-plane/app-state/database.ts:84` constructs repositories for workflow templates, DAG runs, tasks, missions, runs, schedules, events, and artifacts.
- `packages/core/src/control-plane/state-store.ts:46` defines `FileStateStore`; `packages/core/src/control-plane/state-store.ts:71` through `packages/core/src/control-plane/state-store.ts:81` resolves file-backed domains under `.athena`.
- `docs/product/direction/current-direction.md:34` says SQLite is the local app-state store for v1.

PM story slices:

1. Inventory all state domains and mark each as SQLite, file-backed legacy, or intentionally file-backed artifact.
2. Choose migration targets for run templates, harness profiles, directives, and legacy workflows.
3. Add a product-facing state ownership map.
4. Add startup diagnostics that report which stores are active.

Suggested validation:

- Docs/test check that every service domain appears in the state ownership map.
- Migration test for one selected domain before broadening the migration.

## Medium Findings

### M-1 App-state repositories list whole tables and filter in memory

Why it matters: This works in demo-sized state but becomes a scaling cliff once the console has real run/task history. Pagination and filtering need to be pushed into SQL before the console depends on large datasets.

Evidence:

- `packages/core/src/control-plane/app-state/domain-repositories.ts:315` calls `.all()` in `TaskRepository.list` and filters archived/status/mission in memory.
- `packages/core/src/control-plane/app-state/domain-repositories.ts:917` calls `.all()` in `RunRepository.list` and filters target type/id in memory.
- `packages/core/src/control-plane/app-state/domain-repositories.ts:609` returns all schedules, and due filtering happens in `packages/core/src/control-plane/services/local-services.ts:1126`.

PM story slices:

1. Add query-specific SQL statements for task, run, and schedule listing.
2. Add cursor or limit/offset contracts to app-state list APIs that feed console pages.
3. Add regression tests with enough seeded rows to prove bounded reads.

Suggested validation:

- Unit tests assert filtered SQL results match current behavior.
- Lightweight benchmark or instrumentation verifies list calls remain bounded at 10k records.

### M-2 Product direction and Flywheel queue docs are stale after completed work

Why it matters: PM breakdown depends on queue state being trustworthy. The current direction still points to a story in `engineering/active`, while the active lane says no active engineering stories and the done lane lists that story plus the workflow status API as completed. The root backlog README also lists completed/intake stories as current/future work.

Evidence:

- `docs/product/direction/current-direction.md:57` points at `flywheel/backlog/engineering/active/STORY-20260528-workflow-state-store-resumption.md`.
- `flywheel/backlog/engineering/active/README.md:11` says there are no active engineering stories.
- `flywheel/backlog/engineering/done/README.md:7` lists `STORY-20260528-workflow-state-store-resumption.md` and `flywheel/backlog/engineering/done/README.md:8` lists `STORY-20260528-workflow-status-api.md` as completed.
- `flywheel/backlog/README.md:9` and `flywheel/backlog/README.md:15` still list old active and ready items.

PM story slices:

1. Refresh current direction to reflect completed 2026.17 stories.
2. Update root Flywheel backlog summary from lane READMEs.
3. Add a consistency check that catches references to non-existent or moved active/ready items.

Suggested validation:

- `./flywheel/tools/validate_workflow_state.sh`
- New docs consistency test for `docs/product/direction/current-direction.md` and `flywheel/backlog/README.md`.

### M-3 Core service files are too large for the rate of product change

Why it matters: Large services hide unrelated responsibilities and increase review risk. The worst offenders are not just long; they mix orchestration, persistence adaptation, validation, policy resolution, execution, and presentation mapping.

Evidence:

- `packages/core/src/control-plane/services/policy.ts` is 2,122 lines.
- `packages/core/src/control-plane/services/local-services.ts` is 1,709 lines.
- `packages/core/src/control-plane/services/task-workbench.ts` is 1,429 lines.
- `packages/core/src/control-plane/app-state/domain-repositories.ts` is 1,331 lines.
- `packages/core/src/control-plane/backends/k8s-sandbox-execution-backend.ts` is 1,074 lines.

PM story slices:

1. Split task run execution from task CRUD/mapping.
2. Split policy document storage, evaluation, rejection history, and sandbox policy routing.
3. Split domain repositories by aggregate or repository class file.
4. Add ownership notes before refactors so PM can keep stories bounded.

Suggested validation:

- No behavior change expected; run focused existing suites for each extracted module.
- Add import-boundary tests or lint rules only after the first extraction proves the pattern.

## What's Working

The repository has meaningful automated coverage, schema checks, route registration validation, and a visible product direction. The Flywheel handoff history is also strong; completed stories routinely include validation evidence and QA verdicts.

## Highest-Leverage Simplification

Pick one canonical orchestration state model and make every workflow-template, mission, task, schedule, and run surface flow through it. Today the product has a file-backed legacy workflow executor, SQLite mission/task execution, and SQLite workflow DAG state that are all partly true; collapsing that split will make security, recovery, UI status, and PM planning easier.
