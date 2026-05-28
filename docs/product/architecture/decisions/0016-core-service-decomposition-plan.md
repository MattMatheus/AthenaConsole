<!-- AUDIENCE: Internal/Technical -->

# ADR 0016: Core Service Decomposition Plan

## Status

Accepted.

## Context

The Team Orchestrator reset has kept product behavior coherent, but several core files now carry too many responsibilities for the expected rate of change. The code-quality audit identified large hand-maintained files that mix persistence adaptation, orchestration, policy evaluation, execution, validation, and mapping.

Generated files such as `generated-component-schemas.ts` and `api-schemas.ts` are intentionally excluded from the first decomposition plan. They are large, but they are not the primary review-risk surface for product behavior.

## Decision

Decompose core service files incrementally, with no behavior change in the first extraction stories.

The first extraction should split `packages/core/src/control-plane/app-state/domain-repositories.ts` by aggregate/repository class while preserving the existing `../app-state/index.js` export surface. This file is not the largest hand-written file, but it is the safest first proof because its responsibilities are already separated by repository classes and its expected behavior is covered by repository and service tests.

Do not add import-boundary lint rules until at least one extraction proves the pattern. Early enforcement would add process friction before the target module shape is validated.

## Ranked Decomposition Targets

| Rank | File | Current size | Risk | Extraction value | First target boundary |
| --- | --- | ---: | --- | --- | --- |
| 1 | `packages/core/src/control-plane/app-state/domain-repositories.ts` | about 1,400 lines | Medium | High | Split app-state repositories by aggregate while keeping public exports stable. |
| 2 | `packages/core/src/control-plane/services/task-workbench.ts` | about 1,429 lines | High | High | Extract execution backends/run lifecycle from task CRUD, mapping, validation, and artifact/event handling. |
| 3 | `packages/core/src/control-plane/services/local-services.ts` | about 1,707 lines | High | Medium | Extract schedule service and legacy session/artifact helpers into focused modules. |
| 4 | `packages/core/src/control-plane/services/policy.ts` | about 2,122 lines | High | High | Split policy document storage, evaluation, rejection history, sandbox routing, and runtime policy pack resolution. |
| 5 | `packages/core/src/control-plane/backends/k8s-sandbox-execution-backend.ts` | about 1,074 lines | Medium | Medium | Split Kubernetes pod construction, lifecycle polling, logs, and cleanup helpers after runtime policy work stabilizes. |

`policy.ts` is the largest hand-written file, but it is not the first extraction candidate because it crosses authorization, rejection history, sandbox routing, runtime limits, and tests with broader blast radius. It should follow after the repository extraction proves the no-behavior-change pattern.

## Target Module Boundaries

### App-State Repositories

Target directory: `packages/core/src/control-plane/app-state/domain-repositories/`.

Initial split:

- `tasks.ts`: `TaskRepository`, task types, task row mapping, ready-assignment validation.
- `missions.ts`: `MissionRepository`, mission types, mission row mapping.
- `schedules.ts`: `ScheduleRepository`, schedule run history repository, schedule row mapping.
- `runs.ts`: `RunRepository`, run event repository, artifact metadata repository, run/artifact/event row mapping.
- `json.ts` or `shared.ts`: shared JSON encode/decode helpers and bounded-list limit helpers.
- `index.ts`: re-export stable public types/classes for `app-state/index.ts`.

Keep `packages/core/src/control-plane/app-state/domain-repositories.ts` as a compatibility barrel or replace imports with the directory barrel in one mechanical slice. Avoid changing repository method behavior in this story.

### Task Workbench

Target directory: `packages/core/src/control-plane/services/task-workbench/`.

Candidate split:

- task CRUD/list/update service methods and task mapping.
- run lifecycle orchestration.
- local process execution adapter.
- HTTP/API execution adapter.
- runtime safety and policy-pack resolution.
- artifact/event persistence helpers.
- request/output validation helpers.

The first task-workbench extraction should wait until app-state repository split is complete and should move only pure helper groups first.

### Local Services

Target directory: existing `packages/core/src/control-plane/services/`.

Candidate split:

- `schedule-service.ts`: app-state and legacy schedule orchestration.
- `session-service.ts`: session listing/search/transcript/artifact concerns.
- `directive-service.ts`, `harness-profile-service.ts`, `run-template-service.ts`, and `work-service.ts` as separate modules or smaller files.

Schedule extraction should preserve the existing `LocalScheduleService` constructor signature and route behavior.

### Policy Service

Target directory: `packages/core/src/control-plane/services/policy/`.

Candidate split:

- policy document persistence and defaults.
- policy evaluation.
- rejection event history.
- runtime policy pack resolution.
- sandbox routing decisions.
- concurrency and distributed-lock policy integration.

This extraction should be scheduled after current safety and runtime behavior is stable, because the risk of accidental behavior change is higher.

## First Implementation Story

Create an engineering story to split `domain-repositories.ts` by aggregate with no behavior change.

Acceptance expectations:

1. Public imports from `../app-state/index.js` continue to work.
2. Repository behavior, row mapping, ordering, limits, and validation remain unchanged.
3. The split is mechanical and avoids opportunistic query or schema changes.
4. Existing repository, task workbench, mission workbench, schedule, workflow-template, stale-recovery, and API tests pass.
5. `npm --workspace @athena/core run typecheck` passes.

## Validation Matrix

| Extraction target | Focused validation | Broader validation |
| --- | --- | --- |
| App-state repositories | `control-plane.domain-repositories.test.ts`, `control-plane.app-state.test.ts`, `control-plane.stale-run-recovery.test.ts` | task workbench, mission workbench, schedules, workflow template/status tests, typecheck |
| Task workbench | `control-plane.task-workbench.test.ts`, task API tests | schedules, mission runs, policy pack tests, full core unit suite |
| Schedule service | `control-plane.task-schedules.test.ts`, API schedule tests | task workbench, workflow-template instantiation, full core unit suite |
| Policy service | policy fleet tests, authorization tests, sandbox backend tests | API server auth/policy tests, full core unit suite |
| Kubernetes sandbox backend | k8s sandbox backend tests and runtime isolation smoke | policy pack tests, fleet tests, typecheck |

## Alternatives Considered

### Leave Files As-Is Until Feature Work Forces Changes

Rejected. This avoids immediate churn, but it leaves future feature work and bug fixes exposed to large review surfaces and unrelated responsibilities.

### Split By Aggregate/Repository Class

Accepted for the first extraction. The app-state repository file already has clear aggregate boundaries and enough coverage to make a no-behavior-change split practical.

### Split By Service Responsibility First

Deferred. Responsibility-based splits are the right target for task workbench, local services, and policy service, but those files mix more behavior and carry higher regression risk.

## Consequences

The first decomposition story is intentionally modest. It should reduce review friction and establish a repeatable extraction pattern without creating a new abstraction layer.

Future decomposition stories should be short, mechanical, and test-backed. If a proposed extraction needs behavior changes, it should become a separate product/bug story rather than hiding behavior changes inside a refactor.

## Risks

- Churn: moving types and helpers can create noisy diffs. Keep the first story mechanical.
- Import cycles: directory barrels can hide cycles. Prefer one-way dependencies from repositories to shared helpers.
- Test fragility: broad service tests may expose implicit import paths. Keep compatibility exports stable.
- Premature boundaries: do not add lint rules until one extraction proves the boundary shape.
