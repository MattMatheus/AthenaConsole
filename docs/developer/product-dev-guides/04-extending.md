<!-- AUDIENCE: Internal/Technical -->

# Extending Team Orchestrator

This guide covers current implementation extension points. Future extension work should be reframed around formal agents, plugins, lifecycle contracts, and pluggable execution backends.

For authoring a new local plugin-backed agent, start with `packages/core/docs/user/07-pdk-guide.md`. The console is for operating installed agents; plugin manifests and runner files remain the normal authoring path.

## 1. Add a New `ExecutionBackend`

Use this when introducing a new direct run backend (for example a container or remote executor).

Interface: `src/control-plane/backends.ts` `ExecutionBackend`

Required method:

- `run(request, options)`

Recommended methods for full API parity:

- `cancel`
- `cancelByRunId`
- `listActiveRuns`
- `listCancellationRequests`
- `getFleetMetrics`

Guidelines:

- Keep `RunRequest`/`RunResult` compatibility with `src/shared/contracts.ts`.
- Propagate `runId` when available.
- Preserve cancellation semantics (`cancelled` vs `not-running`).
- Ensure compatibility with `PolicyAwareExecutionBackend` wrappers; do not re-implement policy logic in the backend.

## 2. Add a `SandboxExecutionBackend`

Use this for sandbox lifecycle orchestration (claim, readiness, terminate, cleanup).

Interface: `src/control-plane/backends.ts` `SandboxExecutionBackend`

Methods:

- `isAvailable`
- `claim`
- `waitReady`
- `terminate`
- `cleanup`

Guidelines:

- Return explicit unsupported states where appropriate.
- Keep behavior idempotent for terminate/cleanup paths.
- Include runtime class, claim identity, and namespace fields when available to improve observability.

## 3. Wire Into Service Composition

Update `createLocalControlPlaneServices` in `src/control-plane/services.ts` to inject your backend implementation.

Important:

- Keep `PolicyAwareExecutionBackend` as the top-level execution wrapper.
- Keep `Authorized*Service` wrappers in place for policy/schedule/cancel controls.
- Do not move authorization checks into route handlers.

## 4. Add Directive/Harness-Aware Features

If your feature changes execution inputs:

- treat **Directive** and **Harness Profile** as independent artifacts
- keep run request compatibility (`input` or `directiveId` required)
- avoid introducing coupled "envelope" DTOs that bypass shared contracts

## 5. Schema and Test Gates

For shared DTO or API contract changes:

```bash
npm run generate:schemas
npm run check:schemas
npm run typecheck
npm test
```

For runtime-isolation behavior changes, also validate:

```bash
npm run test:runtime-isolation-benchmark:smoke
```
