<!-- AUDIENCE: Internal/Technical -->

# Project Architecture

## Current Direction Note

Team Orchestrator is console-first and local-first. The API remains the transport and service boundary behind the console, CLI, and automation paths.

The accepted product direction is anchored in `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md` and related reset ADRs.

## Control-Plane Composition

`createLocalControlPlaneServices` in `src/control-plane/services.ts` wires the runtime into a layered stack:

1. Base execution backend (`ExecutionBackend`) for actual run execution.
2. `PolicyAwareExecutionBackend` for policy enforcement, distributed lock reservation, runtime-isolation selection, and sandbox lifecycle orchestration.
3. Service layer (`RunService`, `WorkflowService`, `DirectiveService`, etc.) for business APIs.
4. `Authorized*Service` wrappers for role-based enforcement on sensitive mutations.

This keeps route handlers transport-thin and concentrates policy/auth logic in service boundaries.

## API and Auth Path

- HTTP server: `src/api/server.ts`
- Identity middleware: `src/api/middleware/auth.ts`
- Request auth context: `src/control-plane/auth.ts` (`AsyncLocalStorage`)

When `ATHENA_AUTH_ENABLED=true`, the server extracts the configured trusted identity header (`ATHENA_AUTH_IDENTITY_HEADER`), resolves role mapping, and injects the request auth context before route dispatch.

## Execution Backends

### `ExecutionBackend`

`src/control-plane/backends.ts` defines the primary run backend contract:

- `run`
- `cancel`
- `cancelByRunId` (optional)
- active/cancel listing methods (optional)
- runtime/operations metrics method (optional compatibility surface)

### `SandboxExecutionBackend`

The sandbox contract is separate and lifecycle-oriented:

- `isAvailable`
- `claim`
- `waitReady`
- `terminate`
- `cleanup`

`PolicyAwareExecutionBackend` composes both interfaces and decides whether to route through sandbox, fall back, or fail closed for required isolation contexts.

## Structured Workflows (DAG)

Workflow orchestration lives in `LocalWorkflowService` with persisted workflow/run state in `FileStateStore`:

- DAG definition (`steps` + `dependencies`)
- dependency-readiness tracking
- step checkpoint artifacts
- execution logs
- crash-safe resume from stale/failed states

Observability uses `WorkflowRunObservability` to expose current run state, progress, ETA, and artifact references.

## Evidence and Verification

Run execution may attach evidence records through runtime hooks. `LocalRunService` persists evidence and evaluates harness verification policies before returning final `RunResult`.

Current policy support:

- `require-evidence` with optional `evidenceType`

Result-level fields:

- `evidenceCount`
- `verificationStatus`
- `verificationFailures`

## Distributed Locking and Policy

Concurrency policy (`maxConcurrentRuns`) is enforced through lock slot reservation in `PolicyAwareExecutionBackend`.

Supported distributed lock providers:

- `local`
- `redis`
- `k8s-lease`

This lock-backed gate is control-plane safe for multi-instance API deployments.

## Contracts and Schema Workflow

- Canonical DTOs: `src/shared/contracts.ts`
- Route contract metadata: `src/control-plane/api-contracts.ts`
- Generated component schemas: `src/control-plane/generated-component-schemas.ts`
- Runtime schema composition: `src/control-plane/api-schemas.ts`

Contract change workflow:

1. Edit `src/shared/contracts.ts`.
2. Run `npm run generate:schemas`.
3. Run `npm run check:schemas`.
4. Run `npm run typecheck` and `npm test`.
