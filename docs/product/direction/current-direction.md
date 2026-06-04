<!-- AUDIENCE: Internal/Technical -->

# Current Product Direction

## Product

Team Orchestrator is a local-first, web-first agent orchestration product.

The product center is:

- manifest-backed agents packaged in plugins,
- task and mission work management,
- workflow templates that produce repeatable missions/tasks,
- durable SQLite app state,
- inspectable runs, events, artifacts, and histories,
- safety defaults for approvals, limits, and pluggable runtimes,
- a console that lets an operator create, run, inspect, and schedule work.

## Canonical Direction

Current product direction starts from the accepted reset ADRs:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0007-agent-manifest-and-lifecycle-contract.md`
- `docs/product/architecture/decisions/0008-plugin-package-format.md`
- `docs/product/architecture/decisions/0009-task-mission-run-domain-model.md`
- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0011-runtime-backend-interface.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0013-safety-approval-and-loop-limit-model.md`
- `docs/product/architecture/decisions/0014-scheduling-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`
- `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
- `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
- `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`
- `docs/product/architecture/decisions/0022-durable-memory-local-cache-boundary.md`
- `docs/product/architecture/decisions/0023-durable-memory-remote-backend-recommendation.md`
- `docs/product/architecture/decisions/0024-semantic-memory-retrieval-and-sync-strategy.md`

Pre-reset ProjectAthena, Foundry-first, fleet-governance, persona-kit, and A2A-observability records are archived historical context unless rewritten against this direction.

## Delivered Baseline

The reset implementation has delivered:

- SQLite app-state repositories for plugins, agents, tasks, missions, runs, events, artifacts, schedules, and schedule history.
- Plugin and agent manifest validation/indexing.
- Agent catalog API and console surfaces.
- Task creation, execution, run inspection, local-process/container-command/http-api backends, and safety defaults.
- Mission APIs, mission workbench, sequential mission runs, and durable mission run history.
- Workflow-template indexing, instantiation, and schedule support.
- Schedule creation, due execution, workflow-template schedules, and durable schedule run history.
- Workflow-template DAG parsing/validation for dependency-safe future execution.
- Durable workflow DAG run state, resumable stale-step recovery, and visualizer-friendly workflow status APIs.
- Workflow-template instantiation and scheduled workflow-template execution now create and expose a canonical workflow DAG run envelope.
- Workflow-template-projected task runs now update linked workflow DAG steps with real task run lifecycle outcomes.
- A service-only canonical workflow DAG executor can run projected tasks by dependency readiness.
- Canonical workflow DAG startup recovery and service-level resume can recover stale steps and continue without re-running completed dependencies.
- Due workflow-template schedules now execute through canonical workflow DAG runs and record terminal DAG outcomes.
- Console workflow-template instantiation and schedule history now link to workflow DAG run inspection with dependency, readiness, progress, failure, recovery, and event detail.
- Deprecated file-backed `/api/v1/workflows*` APIs were removed; operators use canonical workflow DAG status at `/api/v1/workflow-runs/:runId/status`.
- Run templates, verification evidence, runtime policy packs, and A2A observability reframing migrated into the current Team Orchestrator model.
- Startup recovery for stale task and mission runs left `running` after API/service restart.
- SQL-backed bounded task, run, and schedule list queries for current app-state console/API surfaces.
- A core service decomposition plan that starts with a no-behavior-change app-state repository split.
- App-state domain repositories split by aggregate while preserving the public app-state export surface.

## Current Roadmap

### 2026.17 Workflow DAG Engine

Goal: evolve workflow templates from sequential mission creation into restart-safe DAG-capable workflow execution.

Completed foundation:

- `2026.17.01-implement-workflow-dag-definition-parser`
- `STORY-20260528-workflow-state-store-resumption`
- `STORY-20260528-workflow-status-api`
- `STORY-20260528-workflow-template-dag-run-envelope`
- `STORY-20260528-workflow-dag-step-task-run-linking`
- `STORY-20260528-workflow-dag-executor-service`
- `STORY-20260528-workflow-dag-restart-resume`
- `STORY-20260528-workflow-template-schedule-dag-execution`
- `STORY-20260528-workflow-run-graph-console`
- `STORY-20260528-legacy-workflow-dag-alignment`
- `ARCH-20260528-canonical-orchestration-state-model`

Next implementation refinement:

No workflow DAG implementation candidates remain in refinement.

Source epic:

- `docs/product/epics/completed/2026.17.00-epic-workflow-dag-engine.md`

### 2026.22 State Ownership and SQLite Migration

Goal: make local durable state ownership explicit, reduce split-brain persistence risk, and migrate operator-facing control-plane resources toward SQLite app-state one domain at a time.

Architecture map:

- `docs/product/architecture/state-ownership-map.md`

Next refinement sequence:

- `ARCH-20260528-state-ownership-map`
- `STORY-20260528-state-store-startup-diagnostics`
- `STORY-20260528-harness-profiles-sqlite-migration`
- `STORY-20260528-directives-sqlite-migration`
- `STORY-20260528-run-templates-sqlite-migration`
- `STORY-20260528-session-artifact-state-classification`
- `STORY-20260528-remove-legacy-workflow-file-state`

Source epic:

- `docs/product/epics/completed/2026.22.00-epic-state-ownership-and-sqlite-migration.md`

### 2026.23 Operator Readiness And First-Run Experience

Goal: make Team Orchestrator understandable and useful to a new local operator within the first few minutes after clone/startup.

Engineering sequence:

- `STORY-20260528-first-run-health-readiness`
- `STORY-20260528-sample-plugin-workflow-demo`
- `STORY-20260528-console-empty-states-onboarding`
- `STORY-20260528-quickstart-demo-docs-alignment`

Source epic:

- `docs/product/epics/completed/2026.23.00-epic-operator-readiness-first-run.md`

### 2026.24 Console Product Surface Polish

Goal: make the current console feel coherent after the product-direction reset by cleaning up old branding, old terminology, and flat navigation that mixes primary workflows with advanced or legacy tools.

Completed story sequence:

- `STORY-20260528-console-product-identity-polish`
- `STORY-20260528-console-navigation-surface-grouping`
- `STORY-20260528-operator-dashboard-polish`
- `STORY-20260528-legacy-advanced-surface-containment`

Source epic:

- `docs/product/epics/completed/2026.24.00-epic-console-product-surface-polish.md`

### 2026.25 Operator Workflow Clarity And Repo Wiring

Goal: make it obvious how a local operator wires Team Orchestrator to a repository, understands where agents come from, and starts useful work without needing to author agents inside the console.

Completed story sequence:

- `ARCH-20260529-repo-wiring-operating-model`
- `STORY-20260529-agent-catalog-operating-guidance`
- `STORY-20260529-repo-wiring-guidance-surface`
- `STORY-20260529-create-work-entry-points`
- `STORY-20260529-first-run-to-real-repo-bridge`

Source epic:

- `docs/product/epics/completed/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md`

### 2026.26-2026.30 Real Work Enablement

Goal: let a local operator connect a repository, connect an AI model provider, add useful plugin-backed agents, run real work safely, and prove the system on a local server.

Status: Complete.

Completed architecture item:

- `ARCH-20260529-real-work-enablement-operating-model`

Completed implementation sequence:

- `STORY-20260529-repo-app-state-inspection`
- `STORY-20260529-repo-managed-clone-flow`
- `STORY-20260529-repo-connection-console`
- `STORY-20260529-repo-context-create-work`
- `STORY-20260529-provider-config-secret-model`
- `STORY-20260529-provider-settings-console`
- `STORY-20260529-agent-provider-readiness`
- `STORY-20260529-agent-sdk-core-package`
- `STORY-20260529-example-repo-summary-agent`
- `STORY-20260529-example-generic-research-agents`
- `STORY-20260529-build-your-first-agent-guide`
- `STORY-20260529-manifest-input-schema-forms`
- `STORY-20260529-run-readiness-gates`
- `STORY-20260529-safe-run-modes-and-proposed-changes`
- `STORY-20260529-local-server-compose-profile`
- `STORY-20260529-deployment-readiness-diagnostics`
- `STORY-20260529-fresh-server-real-work-walkthrough`

Source epics:

- `docs/product/epics/completed/2026.26.00-epic-real-work-repo-connection.md`
- `docs/product/epics/completed/2026.27.00-epic-model-provider-and-secrets-setup.md`
- `docs/product/epics/completed/2026.28.00-epic-agent-sdk-and-examples.md`
- `docs/product/epics/completed/2026.29.00-epic-real-work-run-loop.md`
- `docs/product/epics/completed/2026.30.00-epic-local-server-deployment-readiness.md`

### 2026.31 Productization, Documentation, And Agent Developer Kit

Status: Complete.

Goal: move Team Orchestrator from a working local prototype into a product a new operator or agent author can understand, run, extend, and trust without relying on project-history context.

Completed sequence:

- `STORY-20260530-repo-cleanup-audit`
- `STORY-20260530-remove-stale-marketing-app`
- `STORY-20260530-docs-information-architecture`
- `STORY-20260530-agent-developer-kit-hardening`
- `STORY-20260530-agent-scaffold-command`
- `STORY-20260530-product-readiness-smoke-suite`

Source epic:

- `docs/product/epics/completed/2026.31.00-epic-productization-docs-and-agent-developer-kit.md`

### 2026.32 Comprehensive User Documentation

Status: Complete.

Goal: make Team Orchestrator learnable from documentation alone for motivated users who want to operate the system or author agents without reading source code.

Completed story:

- `STORY-20260530-comprehensive-user-guide`
- `STORY-20260530-in-product-documentation-guide`

Source epic:

- `docs/product/epics/completed/2026.32.00-epic-comprehensive-user-documentation.md`

### 2026.33 First Real Work Confidence

Status: Complete.

Goal: repair user-testing gaps that prevent a new single-user or small-team operator from confidently moving from the first-run demo to useful repository work.

Completed engineering sequence:

- `STORY-20260531-repo-task-input-contract`
- `STORY-20260531-advanced-surface-empty-states`
- `STORY-20260531-demo-artifact-preview-confidence`
- `STORY-20260531-workflow-run-output-bridge`
- `STORY-20260531-readiness-first-run-clarity`

Source epic:

- `docs/product/epics/completed/2026.33.00-epic-first-real-work-confidence.md`

### Future Horizon: Durable Memory System

Status: Future horizon.

Goal: make Team Orchestrator memory durable across laptop, local server, and remote server environments. Local SQLite may remain useful for development, tests, cache, and offline behavior, but the product source of truth for durable memory should be remote-capable rather than a DB file copied between machines.

Source roadmap:

- `docs/product/roadmap/future-horizon.md`

Accepted architecture:

- `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`
- `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`
- `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`
- `docs/product/architecture/decisions/0022-durable-memory-local-cache-boundary.md`
- `docs/product/architecture/decisions/0023-durable-memory-remote-backend-recommendation.md`
- `docs/product/architecture/decisions/0024-semantic-memory-retrieval-and-sync-strategy.md`

Source epics:

- `docs/product/epics/completed/2026.34.00-epic-durable-memory-service-architecture.md`
- `docs/product/epics/completed/2026.35.00-epic-remote-memory-mvp.md`
- `docs/product/epics/completed/2026.36.00-epic-memory-governance-agent-integration.md`
- `docs/product/epics/completed/2026.37.00-epic-semantic-memory-and-sync-backends.md`

### Future Horizon: Built-In Capability And Connector Packs

Status: Future horizon.

Goal: make Team Orchestrator useful immediately after setup by shipping first-party plugin-backed agents, connector packs, and workflow templates that compose into more complex flows while serving as canonical examples for users.

Source roadmap:

- `docs/product/roadmap/future-horizon.md`

Source epics:

- `docs/product/epics/completed/2026.38.00-epic-capability-pack-foundation.md`
- `docs/product/epics/completed/2026.39.00-epic-built-in-software-team-agent-pack.md`
- `docs/product/epics/completed/2026.40.00-epic-connector-pack-platform.md`
- `docs/product/epics/completed/2026.41.00-epic-github-connector-pack.md`
- `docs/product/epics/active/2026.42.00-epic-product-intuition-and-start-work-flow.md`
- `docs/product/epics/active/2026.43.00-epic-knowledge-work-connector-pack.md`

### Current Flywheel Priorities

Flywheel lanes are the operational source of truth. The `2026.36` memory governance and agent integration sequence is complete across manifest permissions, runtime context, usage events, proposed review, artifact promotion, and memory-aware run detail.

The `2026.1` local-first release candidate is cut and published as `release-2026.1`.

Post-release roadmap refinement has accepted the durable memory architecture baseline. The accepted architecture records are `docs/product/architecture/decisions/0019-durable-memory-domain-architecture.md`, `docs/product/architecture/decisions/0020-durable-memory-provider-interface.md`, `docs/product/architecture/decisions/0021-durable-memory-namespace-and-provenance-model.md`, `docs/product/architecture/decisions/0022-durable-memory-local-cache-boundary.md`, `docs/product/architecture/decisions/0023-durable-memory-remote-backend-recommendation.md`, and `docs/product/architecture/decisions/0024-semantic-memory-retrieval-and-sync-strategy.md`; `STORY-20260602-durable-memory-server-storage` completed the storage implementation slice, `STORY-20260602-durable-memory-api-routes` completed the API implementation slice, `STORY-20260602-durable-memory-remote-provider-client` completed the remote provider implementation slice, `STORY-20260602-durable-memory-readiness-config` completed the `2026.35` readiness/config slice, and `STORY-20260602-durable-memory-console-inspector` completed the console inspector slice.

The next active product arc is `2026.42 Product Intuition And Start-Work Flow`. It intentionally defers `2026.43 Knowledge Work Connector Pack` until the console is refocused around outcomes, capabilities, resources, work history, and review instead of exposing every implementation primitive as a primary operator choice.

The completed durable-memory governance sequence lives in `flywheel/backlog/engineering/done/` as `STORY-20260602-memory-manifest-permissions.md`, `STORY-20260602-memory-runtime-context.md`, `STORY-20260602-memory-usage-events.md`, `STORY-20260602-memory-proposed-review.md`, `STORY-20260602-memory-artifact-promotion.md`, and `STORY-20260602-memory-aware-run-detail.md`.

Recently completed tracks now live in Flywheel done history:

- `ARCH-20260528-state-ownership-map`
- `STORY-20260528-state-store-startup-diagnostics`
- `STORY-20260528-harness-profiles-sqlite-migration`
- `STORY-20260528-directives-sqlite-migration`
- `STORY-20260528-run-templates-sqlite-migration`
- `STORY-20260528-session-artifact-state-classification`
- `STORY-20260528-remove-legacy-workflow-file-state`
- `STORY-20260528-run-templates`
- `STORY-20260528-run-template-console`
- `STORY-20260528-verification-evidence-model`
- `STORY-20260528-run-verification-inspection`
- `STORY-20260528-runtime-policy-pack-resolver`
- `STORY-20260528-runtime-isolation-policy-packs`
- `STORY-20260528-a2a-observability-reframe`
- `STORY-20260528-legacy-a2a-surface-labeling`
- `STORY-20260528-app-state-list-query-bounds`
- `STORY-20260528-workflow-template-dag-run-envelope`
- `STORY-20260528-workflow-dag-step-task-run-linking`
- `STORY-20260528-workflow-dag-executor-service`
- `STORY-20260528-workflow-dag-restart-resume`
- `STORY-20260528-workflow-template-schedule-dag-execution`
- `STORY-20260528-workflow-run-graph-console`
- `STORY-20260528-legacy-workflow-dag-alignment`
- `STORY-20260528-split-app-state-domain-repositories`
- `ARCH-20260528-service-decomposition-plan`
- `STORY-20260528-first-run-health-readiness`
- `STORY-20260528-sample-plugin-workflow-demo`
- `STORY-20260528-console-empty-states-onboarding`
- `STORY-20260528-quickstart-demo-docs-alignment`
- `STORY-20260528-console-product-identity-polish`
- `STORY-20260528-console-navigation-surface-grouping`
- `STORY-20260528-operator-dashboard-polish`
- `STORY-20260528-legacy-advanced-surface-containment`
- `ARCH-20260529-repo-wiring-operating-model`
- `STORY-20260529-agent-catalog-operating-guidance`
- `STORY-20260529-repo-wiring-guidance-surface`
- `STORY-20260529-create-work-entry-points`
- `STORY-20260529-first-run-to-real-repo-bridge`

Queue status:

- The 2026.33 repo-backed task input contract, advanced surface empty-state, demo artifact preview confidence, workflow output bridge, and readiness first-run clarity repairs are complete.
- No 2026.33 engineering intake items remain.
- No architecture work is active, ready, or awaiting QA.

Planning intake sequence:

- No engineering intake items remain for 2026.33.

## Promotion Rule

A story should not become active unless it has:

- a Flywheel item in `flywheel/backlog/engineering/active/` or `flywheel/backlog/architecture/active/`,
- a source epic or ADR in the current Team Orchestrator direction,
- acceptance criteria and validation expectations,
- an entry in `flywheel/backlog/engineering/active/README.md`,
- valid Flywheel metadata/frontmatter.

Old or candidate material can inspire stories, but it must be rewritten into this structure before execution.
