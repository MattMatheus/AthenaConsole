<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Flight Path

This roadmap describes the current build sequence after the 2026 product-direction reset.

Team Orchestrator is a web-first, local-first agent orchestration product. The current product center is manifest-backed agents, tasks, missions, workflow templates, durable SQLite app state, inspectable runs and artifacts, runtime safety controls, and an operator console.

## Current Baseline

The foundation reset is complete.

Delivered tracks include:

- Foundation app-state, plugin, agent, task, mission, run, event, artifact, schedule, and workflow-template models.
- Local agent catalog and console surfaces.
- Task workbench, mission workbench, run inspection, and schedule UI.
- Workflow-template DAG execution, restart recovery, scheduled DAG execution, and console graph/status inspection.
- Run templates, verification evidence, runtime policy packs, and A2A observability reframing.
- State ownership map, startup diagnostics, SQLite migrations for operator-owned control-plane resources, artifact classification, and removal of legacy workflow file-state runtime paths.

Canonical direction:

- `docs/product/direction/current-direction.md`

Canonical architecture records:

- `docs/product/architecture/decisions/0006-team-orchestrator-direction-and-agent-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`

## Completed Roadmap Tracks

### 2026.17 Workflow DAG Engine

Status: Complete.

Outcome: workflow templates now create durable canonical workflow DAG runs, scheduled workflow-template execution uses DAG runs, stale DAG steps recover on startup, and the console links operators into dependency-aware DAG run inspection.

Source epic:

- `docs/product/epics/refinement/2026.17.00-epic-workflow-dag-engine.md`

### 2026.22 State Ownership And SQLite Migration

Status: Complete.

Outcome: durable state ownership is explicit, startup diagnostics show active stores, directives/harness profiles/run templates use SQLite app-state, artifact payloads are intentionally classified as filesystem-owned, and legacy file-backed workflow runtime APIs are removed.

Source epic:

- `docs/product/epics/refinement/2026.22.00-epic-state-ownership-and-sqlite-migration.md`

### 2026.23 Operator Readiness And First-Run Experience

Status: Complete.

Goal: make the product understandable and useful to a new local operator within the first few minutes after clone/startup.

Why now:

- The runtime foundation is coherent enough to demonstrate end to end.
- The public README is moving toward a public-facing landing page.
- The Flywheel queue is empty, so the next work should improve the operator entry path before adding deeper platform features.

Target outcome:

- A new operator can start the stack, see whether the system is healthy, understand what to do next, run a representative sample, and inspect the resulting run/workflow/artifacts without reading internal planning docs.

Source epic:

- `docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md`

Completed story sequence:

1. `flywheel/backlog/engineering/done/STORY-20260528-first-run-health-readiness.md`
2. `flywheel/backlog/engineering/done/STORY-20260528-sample-plugin-workflow-demo.md`
3. `flywheel/backlog/engineering/done/STORY-20260528-console-empty-states-onboarding.md`
4. `flywheel/backlog/engineering/done/STORY-20260528-quickstart-demo-docs-alignment.md`

### 2026.24 Console Product Surface Polish

Status: Complete.

Goal: make the console feel like a coherent Team Orchestrator product surface after the product-direction reset and first-run work.

Why now:

- The first-run path is complete enough for outside review.
- Visible console cruft from older product direction can distract from the current operator workflow.
- UI polish should happen before adding deeper features so new work lands into a cleaner information architecture.

Target outcome:

- A new or returning operator sees Team Orchestrator branding, clear primary workflows, and advanced/legacy tools that are contained rather than promoted as the main path.

Source epic:

- `docs/product/epics/refinement/2026.24.00-epic-console-product-surface-polish.md`

Completed story sequence:

1. `flywheel/backlog/engineering/done/STORY-20260528-console-product-identity-polish.md`
2. `flywheel/backlog/engineering/done/STORY-20260528-console-navigation-surface-grouping.md`
3. `flywheel/backlog/engineering/done/STORY-20260528-operator-dashboard-polish.md`
4. `flywheel/backlog/engineering/done/STORY-20260528-legacy-advanced-surface-containment.md`

### 2026.25 Operator Workflow Clarity And Repo Wiring

Status: Complete.

Goal: make it obvious how a local operator wires Team Orchestrator to a repository, understands where agents come from, and starts useful work without needing to author agents inside the console.

Why now:

- The console now presents a coherent Team Orchestrator surface.
- Review exposed the next product gap: central primitives can be inspected and run, but the operating model is not yet obvious enough.
- Operators need to know how to add/connect a repo, where agents come from, and which work primitive to create first.
- Agents should remain plugin/manifest-backed; the console should explain that model rather than becoming an agent authoring IDE.

Target outcome:

- A local operator can move from first-run sample usage to running real work against their own repository with plugin-provided agents.

Source epic:

- `docs/product/epics/refinement/2026.25.00-epic-operator-workflow-clarity-repo-wiring.md`

Completed story sequence:

1. `flywheel/backlog/architecture/done/ARCH-20260529-repo-wiring-operating-model.md`
2. `flywheel/backlog/engineering/done/STORY-20260529-agent-catalog-operating-guidance.md`
3. `flywheel/backlog/engineering/done/STORY-20260529-repo-wiring-guidance-surface.md`
4. `flywheel/backlog/engineering/done/STORY-20260529-create-work-entry-points.md`
5. `flywheel/backlog/engineering/done/STORY-20260529-first-run-to-real-repo-bridge.md`

## Next Roadmap Arc

### 2026.26-2026.30 Real Work Enablement

Status: Complete.

Goal: let a local operator connect a repository, connect an AI model provider, add useful plugin-backed agents, run real work safely, and prove the system on a local server.

Why now:

- The first-run and operator-clarity tracks made the system understandable.
- Using environment variables for repo wiring is still too manual for normal operators.
- Agents are visible, but model/provider setup and API key wiring are not yet operator-facing.
- The product needs an SDK/example path so operators can create useful generic agents without authoring agents in the console.
- A local-server deployment is the right end-of-arc proving ground for a durable real-work loop.

Target outcome:

- An operator can deploy Team Orchestrator locally or on a local server, connect a repo, configure a model provider, load or build a useful agent, run work with clear inputs and safety gates, and inspect the result.

Source epics:

1. `docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md`
2. `docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md`
3. `docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md`
4. `docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md`
5. `docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md`

Completed architecture item:

- `flywheel/backlog/architecture/done/ARCH-20260529-real-work-enablement-operating-model.md`

Completed sequence:

1. `flywheel/backlog/architecture/done/ARCH-20260529-real-work-enablement-operating-model.md`
2. `flywheel/backlog/engineering/done/STORY-20260529-repo-app-state-inspection.md`
3. `flywheel/backlog/engineering/done/STORY-20260529-repo-managed-clone-flow.md`
4. `flywheel/backlog/engineering/done/STORY-20260529-repo-connection-console.md`
5. `flywheel/backlog/engineering/done/STORY-20260529-repo-context-create-work.md`
6. `flywheel/backlog/engineering/done/STORY-20260529-provider-config-secret-model.md`
7. `flywheel/backlog/engineering/done/STORY-20260529-provider-settings-console.md`
8. `flywheel/backlog/engineering/done/STORY-20260529-agent-provider-readiness.md`
9. `flywheel/backlog/engineering/done/STORY-20260529-agent-sdk-core-package.md`
10. `flywheel/backlog/engineering/done/STORY-20260529-example-repo-summary-agent.md`
11. `flywheel/backlog/engineering/done/STORY-20260529-example-generic-research-agents.md`
12. `flywheel/backlog/engineering/done/STORY-20260529-build-your-first-agent-guide.md`
13. `flywheel/backlog/engineering/done/STORY-20260529-manifest-input-schema-forms.md`
14. `flywheel/backlog/engineering/done/STORY-20260529-run-readiness-gates.md`
15. `flywheel/backlog/engineering/done/STORY-20260529-safe-run-modes-and-proposed-changes.md`
16. `flywheel/backlog/engineering/done/STORY-20260529-local-server-compose-profile.md`
17. `flywheel/backlog/engineering/done/STORY-20260529-deployment-readiness-diagnostics.md`
18. `flywheel/backlog/engineering/done/STORY-20260529-fresh-server-real-work-walkthrough.md`

## Completed Roadmap Arc

### 2026.31 Productization, Documentation, And Agent Developer Kit

Status: Complete.

Goal: move Team Orchestrator from a working local prototype into a product a new operator or agent author can understand, run, extend, and trust without relying on project-history context.

Why now:

- The real-work path now works locally: repo connection, provider setup, model-backed agents, task runs, artifact inspection, and local-server deployment.
- Review surfaced repo/documentation debt from the product realignment.
- Users need a canonical path to create their own agents, not just copy existing samples.
- The existing `@athena/pdk` package should be hardened into a coherent Agent Developer Kit surface.

Target outcome:

- A new user can start the project, find the right docs, create or scaffold an agent, run a product smoke path, and understand which repo areas are canonical versus historical.

Source epic:

- `docs/product/epics/refinement/2026.31.00-epic-productization-docs-and-agent-developer-kit.md`

Completed sequence:

1. `flywheel/backlog/engineering/done/STORY-20260530-repo-cleanup-audit.md`
2. `flywheel/backlog/engineering/done/STORY-20260530-remove-stale-marketing-app.md`
3. `flywheel/backlog/engineering/done/STORY-20260530-docs-information-architecture.md`
4. `flywheel/backlog/engineering/done/STORY-20260530-agent-developer-kit-hardening.md`
5. `flywheel/backlog/engineering/done/STORY-20260530-agent-scaffold-command.md`
6. `flywheel/backlog/engineering/done/STORY-20260530-product-readiness-smoke-suite.md`

## Completed Roadmap Arc

### 2026.32 Comprehensive User Documentation

Status: Complete.

Goal: make Team Orchestrator learnable from documentation alone for motivated users who want to operate the system or author agents without reading source code.

Outcome: the product now has a comprehensive user guide and in-product documentation guide entry points that explain core concepts, common workflows, troubleshooting paths, and agent-authoring flows without requiring source-code reading.

Source epic:

- `docs/product/epics/refinement/2026.32.00-epic-comprehensive-user-documentation.md`

Completed sequence:

1. `flywheel/backlog/engineering/done/STORY-20260530-comprehensive-user-guide.md`
2. `flywheel/backlog/engineering/done/STORY-20260530-in-product-documentation-guide.md`

### 2026.33 First Real Work Confidence

Status: Complete.

Goal: repair user-testing gaps that prevented a new single-user or small-team operator from confidently moving from the first-run demo to useful repository work.

Outcome: the first real-work path now has a normalized repo task input contract, clearer advanced-surface empty states, demo artifact preview confidence, workflow task-run evidence in workflow context, and readiness lanes that separate demo readiness from provider/server-hardening warnings.

Source epic:

- `docs/product/epics/refinement/2026.33.00-epic-first-real-work-confidence.md`

Completed sequence:

1. `flywheel/backlog/engineering/done/STORY-20260531-repo-task-input-contract.md`
2. `flywheel/backlog/engineering/done/STORY-20260531-advanced-surface-empty-states.md`
3. `flywheel/backlog/engineering/done/STORY-20260531-demo-artifact-preview-confidence.md`
4. `flywheel/backlog/engineering/done/STORY-20260531-workflow-run-output-bridge.md`
5. `flywheel/backlog/engineering/done/STORY-20260531-readiness-first-run-clarity.md`

## Current Flywheel Priorities

Flywheel lanes are the operational source of truth. No engineering or architecture story is currently active.

Release readiness cleanup for the `2026.1` local-first release candidate is complete. Remaining pre-tag work is final validation, product smoke, manual browser smoke, release notes review, and tag publication.

Until the `2026.1` release is cut, avoid adding more general product surface area. The next product arc should focus on built-in capabilities: more bundled agents, stronger sample plugins, and pre-built task or workflow templates that make Team Orchestrator useful immediately after install.

## Near-Term Principles

- Prefer complete local operator loops over new isolated backend features.
- Keep the first-run path honest: only document and expose workflows that actually work in the current product.
- Treat docs, console empty states, diagnostics, and sample data as product surfaces.
- Do not reintroduce legacy compatibility shims for removed control-plane paths.
- Keep Flywheel as the operational source of truth for active and queued work.
- Keep the real-work loop centered on explicit repo context, explicit provider configuration, and explicit approvals before mutations or external side effects.
- When review exposes gaps, create explicit Flywheel intake items instead of reviving stale roadmap entries.

## Archived Roadmap Context

The superseded pre-reset roadmap snapshot is archived at:

- `docs/product/archive/2026-product-direction-reset/roadmap-snapshot/vision-roadmap.md`
