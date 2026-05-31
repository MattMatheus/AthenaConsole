# Advanced Usage

This guide covers higher-order orchestration features: directives/harness profiles, DAG workflows, verification policies, and distributed control.

## Decoupled Execution Model

Athena separates task intent from execution policy:

- **Directive**: prompt/input payload + optional `contextRefs` and metadata.
- **Harness Profile**: provider/model/tools, runtime policies, and optional `verificationPolicies`.

Typical flow:

1. Create reusable directives with `POST /api/v1/directives`.
2. Create harness profiles with `POST /api/v1/harness-profiles`.
3. Execute runs with `POST /api/v1/runs` using `directiveId` and `harnessProfileId`.

## Workflows

Team Orchestrator workflows are instantiated from plugin workflow templates and tracked as workflow DAG runs.

Workflow APIs:

- `GET /api/v1/workflow-templates` to list available plugin templates.
- `POST /api/v1/workflow-templates/:id/instantiate` to create a mission and workflow run.
- `GET /api/v1/workflow-runs/:runId/status` for graph status, step readiness, and run output links.
- `POST /api/v1/workflow-runs/:runId/execute` to execute ready workflow steps.

Key behavior:

- Step readiness is dependency-aware (`blockingStepIds`, `readyDependencies`).
- Workflow runs expose progress, recovery metadata, and linked task run ids.
- Task run detail is the canonical place to inspect task output and artifacts.

## Evidence and Verification Policies

Harness profiles may include `verificationPolicies`.

Current supported policy kind:

- `require-evidence`: require at least one non-empty evidence record for a target evidence type (`text`, `json`, or `binary`).

Run result fields:

- `evidenceCount`
- `verificationStatus` (`passed` or `verification-failed`)
- `verificationFailures` (policy-level diagnostics)

## Sandbox Routing and Runtime Isolation

`PolicyAwareExecutionBackend` routes runs through the configured sandbox backend when enabled/required. This ensures that agent tasks (like executing commands or scripts) are isolated from the host system.

### Sandbox Providers

Athena supports two primary sandbox execution providers:

- **Docker**: Executes agent commands in a dedicated Docker container.
- **Kubernetes (K8s)**: Executes agent commands in a temporary K8s pod.

### Configuration

Relevant config:

- `ATHENA_SANDBOX_ENABLED`: Enable the sandbox routing logic (default: `false`).
- `ATHENA_EXECUTION_PROVIDER_DEFAULT`: Selects the default sandbox backend (`docker` by default; also supports `k8s` and `local-placeholder`).
- `ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE`: The default isolation level (`standard` or `high-security`).
- `ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX`: Set to `true` to require a sandbox for standard runs.
- `ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX`: Set to `true` to require a sandbox for high-security runs.
- `ATHENA_RUNTIME_ISOLATION_*_RUNTIME_CLASS`: Optional K8s `RuntimeClass` for isolation (e.g., `kata-containers`, `gvisor`).

When sandbox routing is active, Athena emits `sandbox.lifecycle` events with versioned metadata (`schemaVersion: 1`).

## Failed Work Recovery

Athena records recoverable task and workflow failures as failed work items so operators can inspect payloads, request retries, or discard terminal failures with audit notes.

- **API**: `/api/v1/failed-work`
- **Actions**:
  - `GET /api/v1/failed-work`: List failed work items.
  - `POST /api/v1/failed-work/:id/retry`: Request a retry for the failed item.
  - `POST /api/v1/failed-work/:id/discard`: Permanently discard the failed item.

Failed work is visible and manageable via the [Team Orchestrator Console](08-console-ui.md).

## Distributed Locking and Policy Enforcement

Athena enforces concurrency policy (`maxConcurrentRuns`) with lock-backed reservations.

Providers:

- `ATHENA_LOCK_PROVIDER_DEFAULT=local` (default behavior)
- `ATHENA_DISTRIBUTED_LOCK_PROVIDER=local`
- `ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis` + `ATHENA_REDIS_URL`
- `ATHENA_DISTRIBUTED_LOCK_PROVIDER=k8s-lease`

Rejections are visible through:

- `GET /api/v1/policy/rejections`
- `policy.rejected` and `policy.concurrency.rejected` event types

## Trusted-Header RBAC for Operators

Enable API identity middleware for production gateways or trusted internal ingress:

- `ATHENA_AUTH_ENABLED=true`
- `ATHENA_AUTH_API_TOKEN=<secret value with at least 16 characters>` when the API is externally reachable
- `ATHENA_AUTH_IDENTITY_HEADER=x-athena-identity`
- `ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Admin,bob:Operator,*:Viewer`
- `ATHENA_AUTHZ_MODE=enforce`
- `ATHENA_AUTHZ_DEFAULT_DECISION=deny`

Externally bound API startup is refused unless token auth is configured or
`ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true` is set for explicit local development. Current deny paths are enforced in
service wrappers and return structured `AUTHZ_DENIED` errors.
