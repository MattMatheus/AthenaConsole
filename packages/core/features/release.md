# ProjectAthena v1.0 Release Epics

## Release Goal

Deliver a production-ready multi-agent runtime that can launch isolated Athena agents as Kubernetes pods, coordinate them through a management agent, and enable secure, observable agent-to-agent communication.

## Scope Guardrails

- In scope: Kubernetes-native execution, control-plane orchestration, inter-agent communication primitives, observability, and failure handling.
- Out of scope for v1.0: multi-cluster federation, external messaging/channel adapters, and fully autonomous long-running swarms without operator policy constraints.

## Epic 1: Kubernetes Pod Runtime for Isolated Athena Agents

### Problem

Athena currently runs as a CLI/runtime process. v1.0 needs isolated execution units that can be scheduled, resource-limited, and lifecycle-managed in Kubernetes.

### Outcome

Operators can launch Athena agents as isolated pods with deterministic startup, per-agent configuration, and safe teardown.

### v1.0 Deliverables

- Containerized Athena runtime image with versioned tags.
- Kubernetes deployment model for short-lived and long-running agent pods.
- Pod template support for:
  - CPU/memory requests and limits
  - environment/config injection
  - workspace/data volume mounts
  - service account and RBAC bindings
- Session/work queue state strategy compatible with pod restarts.
- Health/readiness probes and termination handling.
- Standard operational docs: deploy, upgrade, rollback, and incident triage.

### Acceptance Criteria

- Agent pod launch succeeds through a declarative spec (no manual shell steps).
- Pod restart does not corrupt `.athena` state or orphan queue locks.
- Resource policies enforce isolation between concurrent agents.
- Observability baseline exists (logs + metrics + trace correlation IDs).

### Dependencies

- Runtime state locking/persistence guarantees under container restarts.
- Config contract updates for Kubernetes runtime mode.

### Risks

- File-backed local state may not be sufficient for high pod churn.
- Misconfigured RBAC or volume policies could break agent startup.

## Epic 2: Athena Management Agent for Subagent Pod Operations

### Problem

A single control-plane mechanism is required to create, monitor, and terminate subagent pods with policy controls and lifecycle guarantees.

### Outcome

A management agent can reconcile desired work into subagent pod executions and report status/results back into Athena session context.

### v1.0 Deliverables

- Management agent module responsible for subagent pod orchestration.
- Reconciliation loop:
  - desired task -> pod creation
  - pod status tracking -> Athena work updates
  - terminal status -> result handoff + cleanup
- Policy layer for:
  - max concurrent pods per session/tenant
  - retry/backoff rules
  - timeout/TTL enforcement
  - cancellation semantics
- Failure recovery for controller restart (resume tracking without duplicate pod creation).
- CLI/API hooks for operator visibility (list, inspect, cancel subagents).

### Acceptance Criteria

- Management agent can launch and supervise N subagents concurrently with configured limits.
- Reconciliation remains idempotent across crashes/restarts.
- Stuck/failed subagent pods are detected and handled per policy.
- Operators can trace parent session -> subagent pod -> result artifact.

### Dependencies

- Epic 1 pod runtime primitives.
- Stable contracts for work item lifecycle and result payload schemas.

### Risks

- Duplicate execution if reconciliation keys are not deterministic.
- Control loop drift under eventual consistency of Kubernetes API.

## Epic 3: Agent-to-Agent Communication (A2A) Baseline

### Problem

Subagents must exchange task context and outputs in a way that is reliable, secure, and auditable without introducing tight coupling.

### Outcome

A clear, production-viable A2A communication strategy with one primary path for v1.0 and an extension path for post-1.0.

### Candidate Solutions Review

1. Shared durable queue/topic (recommended for v1.0)
- Model: agents publish typed messages/events to a broker-backed queue; consumers process with acknowledgements.
- Pros: decoupled, resilient to agent restarts, native retry/dead-letter patterns, good audit trail.
- Cons: adds broker dependency and message schema/version management.
- Fit for Athena: aligns with existing work queue concepts and async orchestration model.

2. Direct service-to-service RPC (HTTP/gRPC)
- Model: agent calls another agent endpoint directly.
- Pros: low latency, straightforward request/response semantics.
- Cons: tighter coupling, service discovery complexity, harder retry/idempotency, weaker offline tolerance.
- Fit for Athena: acceptable for narrowly scoped synchronous calls, weaker default for autonomous subagent fleets.

3. Shared state store polling (e.g., DB/object store mailbox)
- Model: agents write/read communication documents from shared storage.
- Pros: simple operationally, strong persistence.
- Cons: polling inefficiency, higher coordination complexity, weaker real-time behavior.
- Fit for Athena: useful as fallback/archive layer, not ideal as primary real-time transport.

### v1.0 Recommendation

Adopt queue/topic-based asynchronous messaging as the primary A2A transport for v1.0, with optional synchronous RPC only for control-plane lookups where low-latency request/response is required.

### v1.0 Deliverables

- A2A message contract in `src/shared/contracts.ts`:
  - envelope (id, correlation id, causation id, type, source/target agent)
  - payload schema versioning
  - timestamps + delivery metadata
- Reliability controls:
  - idempotency keys
  - retry policy
  - dead-letter handling
  - poison message quarantine
- Security controls:
  - namespace/tenant isolation
  - authn/authz between agents
  - optional payload encryption at rest/in transit
- Observability:
  - message tracing across parent and subagents
  - delivery latency/error metrics

### Acceptance Criteria

- Agents can exchange messages with at-least-once delivery and idempotent processing.
- Failed messages are routed to dead-letter handling and surfaced to operators.
- Message lineage is queryable using correlation IDs across runtime logs.
- Backward-compatible schema evolution rules are documented and tested.

### Dependencies

- Management agent lifecycle events from Epic 2.
- Shared contract versioning discipline.

### Risks

- Event schema drift without strict compatibility checks.
- Retries may cause duplicate side effects if handlers are not idempotent.

## Cross-Epic Non-Functional Requirements (v1.0)

- Security: least-privilege RBAC, workload identity, secrets management policy.
- Reliability: crash-safe state transitions, idempotent reconcile/handlers.
- Operability: dashboard-ready metrics, structured logs, runbook coverage.
- Performance: configurable concurrency ceilings and backpressure behavior.
- Testability: integration test harness for pod launch, reconciliation, and A2A failure modes.

## Proposed Milestones

1. M1: Pod runtime foundation (Epic 1 core deploy and lifecycle)
2. M2: Management reconciliation (Epic 2 core orchestration)
3. M3: A2A transport and contracts (Epic 3 baseline)
4. M4: hardening, observability, and release readiness (cross-epic)

## Definition of Done for v1.0

- All epic acceptance criteria met.
- End-to-end scenario validated: parent Athena session launches subagents, subagents communicate, results reconcile, and full trace is observable.
- Operator documentation complete for deploy, rollback, failure handling, and scaling.
