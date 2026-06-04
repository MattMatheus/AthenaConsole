<!-- AUDIENCE: Internal/Technical -->

# ADR 0025: Product Intuition And Start Work IA

## Status

Accepted.

## Context

Team Orchestrator's product direction is still sound: a local-first, inspectable console where operators run agent work safely and can understand what happened.

The current console exposes too many implementation primitives as primary operator choices. Agents, tasks, missions, workflows, schedules, run templates, resources, memory, settings, approvals, and diagnostics are all valid product concepts, but making them peer navigation items forces users to think like system designers before they can start useful work.

The next product arc should repair that product shell before adding more connector surface area.

## Decision

Use an intent-led primary information architecture.

Primary operator surfaces should be:

- **Start Work**: choose an outcome or capability before selecting a task/workflow primitive.
- **Work History**: inspect active, completed, failed, and scheduled work.
- **Capabilities**: browse what Team Orchestrator can do, backed by agents and workflow templates.
- **Resources**: configure repositories, providers, connector credentials, and other usable context.
- **Review**: inspect proposed changes, approvals, memory proposals, audit-sensitive outcomes, and blocked work.

Advanced and author/admin surfaces should remain reachable but should not dominate the first-use path:

- Agents.
- Workflow templates and workflow DAG detail.
- Missions.
- Run templates.
- Schedules.
- Policy/RBAC.
- Audit trail.
- Failed-work diagnostics.
- Raw JSON inputs.

Implementation primitives remain intact. A capability may resolve to an agent-backed task or a workflow-template-backed mission/workflow run. The operator should see the underlying primitive before execution, but should not have to choose the primitive first.

## Surface Classification

| Current surface | Target classification | Notes |
| --- | --- | --- |
| Dashboard | Primary | Should emphasize readiness plus Start Work, not primitive selection. |
| Tasks | Advanced/detail | Still usable directly, but Start Work should create task-backed work for users. |
| Workflows | Advanced/detail | Workflow templates become capability backing details or recipes. |
| Missions | Advanced/detail | Keep for inspection/grouping, not as a first action. |
| Schedules | Secondary or advanced | Surface from selected work after capability setup. |
| Run Templates | Advanced | Author/admin preset surface. |
| Agents | Secondary/author | Rename or present as Capabilities for operators where practical. |
| Run History/Sessions | Primary as Work History | Keep execution inspectability central. |
| Resource Controls | Primary as Resources | Repositories, providers, and connector bindings belong here. |
| Memory | Review/Resources split | Memory proposals are Review; memory configuration/inspection is Resources or advanced. |
| Audit/RBAC/Failed Work/Settings | Advanced admin | Still reachable for safety and operations. |

## Start Work Requirements

The first implementation slice should add a Start Work route or equivalent primary dashboard section that:

1. Presents outcome-oriented cards such as running the first-run demo, summarizing a repo, reviewing code, drafting release notes, and explaining test failures.
2. Uses existing bundled software-team and GitHub capability metadata where possible.
3. Routes to existing task/workflow creation with the backing primitive preselected or clearly suggested.
4. Keeps the underlying agent/workflow visible as reviewable detail before execution.
5. Avoids new backend domain models and new connector scope.

## Alternatives Considered

### Keep Current Navigation And Add More Copy

Rejected. The issue is not only missing explanation; it is that the product asks users to make primitive-level choices too early.

### Rename Agents To Capabilities Only

Rejected as insufficient. Renaming helps, but the work-start flow still needs to move from primitive-led to outcome-led.

### Add Start Work While Keeping All Primitives Primary

Accepted only as an intermediate implementation step. The first story may add Start Work without completing all navigation containment, but the target IA is to reduce primitive prominence over subsequent stories.

### Remove Missions, Tasks, Or Workflow Templates

Rejected. These models support inspectability, composition, and restart-safe execution. The problem is exposure hierarchy, not domain existence.

## Consequences

- New implementation stories should optimize for outcome-led setup rather than adding standalone primitive screens.
- The dashboard should stop asking users to "choose the right primitive."
- Docs should explain outcomes and inspection before the full domain model.
- Connector expansion, including knowledge-work connectors, should wait until this product shell is easier to use.

## Risks

- Safety details could be hidden if Start Work becomes too minimal. Mitigation: every selected capability must have a preflight/review step.
- Existing users may rely on primitive routes. Mitigation: preserve direct routes and deep links where practical.
- Capability metadata may be inconsistent between agent-backed and workflow-backed work. Mitigation: start with curated bundled outcomes, then normalize metadata in later stories if needed.

## Follow-On Work

- `STORY-20260603-start-work-entry-point`
- `STORY-20260603-capability-led-work-creation`
- `STORY-20260603-guided-work-preflight`
- `STORY-20260603-advanced-surface-containment`
- `STORY-20260603-intent-led-docs-alignment`
