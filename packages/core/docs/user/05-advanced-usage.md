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

## Workflows (DAG Engine)

Athena workflows model multi-step execution with explicit dependencies.

Workflow APIs:

- `POST /api/v1/workflows` to define a DAG (`steps` + `dependencies`)
- `GET /api/v1/workflows` to list
- `GET /api/v1/workflows/run/:id` for observability state
- `POST /api/v1/workflows/run/:id/resume` for crash-safe resumption

Key behavior:

- Step readiness is dependency-aware (`blockingStepIds`, `readyDependencies`).
- Workflow runs persist step checkpoints and execution logs.
- Resume recovers stale running steps and restarts from the first failed node.

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

## Agent-to-Agent (A2A) and Dead-Letter Queue (DLQ)

Athena supports complex agent-to-agent (A2A) interactions where one persona can trigger another. For example, a `software-architect` persona could trigger a `code-review` persona.

### Dead-Letter Queue (DLQ)

To handle failures in asynchronous A2A messages, Athena includes a Dead-Letter Queue (DLQ).

- **API**: `/api/v1/a2a/dlq`
- **Actions**:
  - `GET /api/v1/a2a/dlq`: List all failed A2A messages.
  - `POST /api/v1/a2a/dlq/:id/requeue`: Re-attempt the failed message.
  - `POST /api/v1/a2a/dlq/:id/discard`: Permanently discard the failed message.

The DLQ is visible and manageable via the [Athena Console](08-console-ui.md).

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
- `ATHENA_AUTH_IDENTITY_HEADER=x-athena-identity`
- `ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Admin,bob:Operator,*:Viewer`

Current deny paths are enforced in service wrappers and return structured `AUTHZ_DENIED` errors.
