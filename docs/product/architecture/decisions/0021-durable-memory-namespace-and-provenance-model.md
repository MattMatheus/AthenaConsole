<!-- AUDIENCE: Internal/Technical -->

# ADR 0021: Durable Memory Namespace And Provenance Model

## Status

Accepted.

## Context

ADR 0019 defines durable memory as remote-capable product memory with explicit provenance. ADR 0020 defines the backend-neutral provider interface and leaves namespace/provenance semantics to this decision.

Team Orchestrator already has durable ids and provenance anchors for many relevant concepts:

- tasks have ids, assigned agents, capability requirements, `createdBy`, and optional provenance JSON,
- task and mission runs have run ids, target ids, run events, and artifact metadata,
- workflow template execution has canonical workflow DAG run ids and workflow step ids,
- connected repositories have app-state ids plus workspace paths and inspection state,
- plugin and agent catalog records have plugin id/version and agent id/version,
- authorization wrappers already separate service authorization from lower-level storage/service implementations.

Durable memory must use these anchors without pretending that a repository path, run id, or artifact id alone is enough to decide visibility. The default posture should prevent accidental cross-scope memory leakage.

## Decision

Define durable memory namespaces as explicit hierarchical scope references, and define provenance as required source evidence for every memory mutation.

The durable memory provider interface should continue to carry `DurableMemoryNamespaceRef` and `DurableMemoryProvenanceRef`, but services above the provider own authorization, permission checks, audit events, and cross-scope policy.

Memory reads and writes default to the narrowest practical scope. Cross-scope reads require explicit scope widening and authorization. Cross-scope writes, archive/delete operations, and snapshot restores require operator-visible reason strings and audit/event correlation.

## Namespace Scopes

Durable memory namespace scopes are:

| Scope | Stable id source | Parent guidance | Default use |
| --- | --- | --- | --- |
| `account` | Future account id or single-user account placeholder | Root scope | Account-wide settings or preferences. Not required for local-only MVP. |
| `operator` | Auth identity subject or local operator id | Optional account | Operator-specific preferences and notes. |
| `workspace` | Team Orchestrator workspace id or configured workspace root identity | Optional account/operator | Local or server workspace continuity. |
| `project` | Product/project id selected by future project model | Workspace | Project-wide durable knowledge. |
| `repository` | Connected repository id, not raw path | Workspace or project | Repo-specific facts, summaries, decisions, and agent context. |
| `team` | Future team id | Account, workspace, or project | Shared team knowledge. |
| `agent` | Agent id plus version when version matters | Workspace, project, repository, or team | Agent-specific learned behavior or configuration notes. |
| `task` | Task id | Repository, project, workspace, or mission context | Task-scoped working memory. |
| `run` | Task/mission run id or workflow DAG run id | Task, mission, workflow, repository, or project context | Execution-scoped memory and proposed writes. |
| `artifact` | Artifact id plus run id | Run | Artifact-derived memory proposals or summaries. |

Use connected repository ids for repository scope when available. Repository paths are diagnostic attributes, not namespace ids, because path strings can differ across laptop, local server, and remote server environments.

## Namespace Hierarchy Rules

1. A namespace must include `scope` and `id`.
2. A namespace may include `parent`, but services should normalize parent chains before persistence.
3. Child scopes do not automatically grant access to parent or sibling scopes.
4. Parent-scope reads may include child scopes only when the request explicitly asks for descendants and authorization allows it.
5. Sibling repository, project, workspace, operator, or team scopes are isolated by default.
6. Run and artifact scopes are not durable sharing scopes by themselves; durable records derived from them should normally be proposed into repository, project, workspace, team, operator, or account scope after review.
7. Team-scope memory must not be visible to a repository or project run unless the task/run context includes that team scope and the operator/agent is authorized for it.

## Default Read Boundaries

Default read scope should be:

- task run: task scope plus its run scope, and repository/project/workspace scopes explicitly attached to the task context,
- workflow run: workflow run scope plus linked task/run scopes and explicitly attached repository/project/workspace scopes,
- agent execution: only scopes explicitly granted by the task/run context and agent manifest permissions,
- operator console search: scopes selected by the operator or current workspace, with sensitive scopes filtered by authorization,
- connector ingestion: connector-specific import scope until reviewed or promoted.

Provider implementations may support broader queries, but product services must build the query scopes deliberately.

## Default Write Boundaries

Default write target should be narrow:

- operator note: operator or workspace scope selected in the UI,
- agent-generated proposal: run scope first, then proposed promotion to repository/project/workspace/team/operator scope,
- artifact-derived memory: artifact/run scope first, then proposed promotion,
- task summary: task or run scope first, with explicit promotion to repository/project/workspace if intended to persist beyond the task,
- connector-derived memory: connector import scope first, with explicit promotion after review.

Direct writes to team, account, project, or repository scope require authorization and should carry an explicit reason. Sensitive or secret-adjacent writes should default to proposal mode.

## Required Provenance By Source Kind

Every memory record, proposal, archive/delete, and snapshot restore must carry provenance.

| Source kind | Required provenance | Notes |
| --- | --- | --- |
| `operator` | `actorType: operator`, `actorId`, `createdByAction` | Used for direct notes, edits, approvals, archives, deletes, and restores. |
| `agent` | `actorType: agent`, `agentId`, `runId` or `taskId`, `createdByAction` | Agent writes should normally be proposals unless permissions allow direct writes. |
| `task-run` | `taskId`, `runId`, `agentId` when assigned, `createdByAction` | Link to task run detail and event timeline. |
| `workflow-run` | `workflowRunId`, optional `taskId`/`runId` for step evidence, `createdByAction` | Link to workflow DAG status and step evidence. |
| `artifact` | `artifactId`, `runId`, `taskId` when available, `createdByAction` | Artifact id alone is insufficient. |
| `connector` | connector id, external source uri, import/run id when available, `createdByAction` | Connector-specific fields can live in payload/provider metadata until connector ADRs refine them. |
| `import` | import job id or source uri, `actorId` or system actor, `createdByAction` | Used for bulk/manual import flows. |
| `system` | `actorType: system`, `createdByAction`, trace/run id when available | System-created memory should be rare and auditable. |

The provider placeholder fields from ADR 0020 remain valid, but implementation should add validation helpers that reject missing required provenance for the source kind being written.

## Memory Mutation Events

Accepted memory mutations should emit operator-visible events after the memory service layer is implemented.

Recommended event types:

- `memory.proposal.created`
- `memory.proposal.approved`
- `memory.proposal.rejected`
- `memory.record.written`
- `memory.record.archived`
- `memory.record.deleted`
- `memory.snapshot.created`
- `memory.snapshot.restored`

Events should include:

- memory id or proposal id,
- namespace scope and id,
- source kind,
- provenance ids,
- sensitivity,
- actor type/id,
- reason when supplied,
- provider request id or trace id when available.

Events must not include memory body, structured payload, transcript body, raw artifact payload, external connector secret data, or raw provider credentials.

## Proposals And Promotion

Agent, artifact-derived, connector-derived, and run-derived memory should prefer proposal mode when writing outside the run/task/artifact scope.

Promotion means converting a proposed or narrow-scope record into a broader durable scope. Promotion requires:

- target namespace,
- source record/proposal id,
- operator or approved-system actor,
- reason,
- retained provenance chain,
- event/audit trail.

Promotion must not erase the original run/artifact/task provenance.

## Archive, Delete, And Snapshot Restore

Archive/delete and snapshot restore operations are high-risk because they can hide, remove, or revive context across scopes.

Defaults:

- archive requires `reason` and emits an event,
- delete requires `reason`, should default to soft delete or provider-supported archive where possible, and emits an event,
- hard delete requires elevated authorization and should remain unavailable until governance work defines retention and legal/privacy posture,
- snapshot restore requires target namespace, reason, actor, and event/audit trail,
- snapshot restore must not restore into a broader scope than the snapshot namespace unless explicitly approved.

## Relationship To Provider Interface

ADR 0020 provider placeholders become stable enough for implementation with these rules:

- `DurableMemoryNamespaceRef.scope` and `id` are required.
- `DurableMemoryNamespaceRef.parent` is optional but should be normalized by services.
- `DurableMemoryProvenanceRef.actorType` and `createdByAction` are required for mutations.
- Source-kind-specific provenance requirements are validated above the provider.
- `repositoryId`, `taskId`, `runId`, `workflowRunId`, `artifactId`, `agentId`, and `actorId` should use existing Team Orchestrator ids where available.

Details still deferred:

- exact local cache replication behavior,
- remote backend storage schema,
- connector-specific external identity shape,
- hosted multi-tenant account/team model,
- semantic retrieval indexing rules.

## Alternatives Considered

### Flat Namespace Strings Only

Rejected. Flat strings are easy to implement but make parent/child scope, descendant queries, and cross-scope leak checks too implicit.

### Repository Scope For All Memory

Rejected. Repository scope is important but not enough for operator preferences, workspace notes, team knowledge, task-local memory, workflow evidence, connector imports, or future account/project contexts.

### Optional Run And Artifact Provenance

Rejected. Durable memory needs inspectability. Run/artifact-derived memory without run and artifact links would be difficult to audit or reverse.

### Hierarchical Namespace References With Required Provenance

Accepted. This fits ADR 0019/0020, preserves local-first operation, and gives future authorization, audit, and provider work concrete boundaries.

## Consequences

Durable memory work can now implement provider-interface types with stable namespace/provenance rules instead of placeholders only.

Memory-aware agents should not read or write broad scopes by default. Runtime context and manifest permissions must explicitly grant memory access.

Future UI/API work should let operators see memory source provenance and scope, not just record body.

Local cache and backend stories can focus on persistence/sync choices because scope and provenance defaults are now defined.

## Follow-On Work

1. Implement provider-interface types with namespace/provenance validation helpers.
2. Refine `2026.34.04 Local Cache Boundary` to decide how current SQLite/FTS diagnostic search maps to cache, dev backend, or legacy diagnostic surface.
3. Refine `2026.34.05 Remote Backend Recommendation`.
4. Defer memory-aware agent permissions, proposal review UI, and durable memory APIs until the remaining `2026.34` decisions are accepted.

## Validation

Architecture QA should confirm that this ADR:

- defines namespace scopes and hierarchy rules,
- defines required provenance by source kind,
- defaults to narrow read/write scopes,
- covers cross-scope proposals, promotion, archive/delete, and snapshot restore,
- maps to current task, run, workflow DAG run, artifact, repository, agent, plugin, and authorization concepts,
- keeps local cache behavior and backend choice deferred to their dedicated stories.
