---
kind: story
id: STORY-20260530-docs-information-architecture
status: qa
owner_role: Technical Writer
source: planning
success_metric: New users can find operator, admin, contributor, and agent-author docs from one canonical index.
release_scope: required
ready: false
---

# Story: Documentation Information Architecture

## Metadata
- `id`: STORY-20260530-docs-information-architecture
- `owner_role`: Technical Writer
- `status`: qa
- `source`: planning
- `decision_refs`: [0006, 0007, 0008, 0009, 0018]
- `success_metric`: New users can find operator, admin, contributor, and agent-author docs from one canonical index.
- `release_scope`: required

## Problem Statement

Docs exist, but they are split across root files, product docs, developer guides, core package docs, and console documentation. A user who wants to create an agent or run real work should not need to infer which tree is current.

## Scope
- In: canonical docs index, audience labels, operator path, admin/server path, agent-author path, contributor path, stale-link cleanup.
- Out: full public website redesign, exhaustive API reference generation.

## Assumptions
- `README.md` and `GETTING_STARTED.md` remain the main repo entry.
- Product planning and Flywheel remain internal docs, not the primary user path.

## Acceptance Criteria
1. The top-level documentation index maps the supported audiences and their first page.
2. Operator docs explain install/start, provider setup, repo connection, creating/running tasks, and inspecting artifacts.
3. Agent-author docs explain plugin structure, manifest fields, inputs, runner contract, testing, and duplicate-id troubleshooting.
4. Internal product/Flywheel docs are clearly labeled as internal.
5. Obsolete or conflicting links are removed or redirected.

## Validation
- Required checks: docs link/path review, `rg` stale title scan, `git diff --check`.
- Additional checks: manual new-user walkthrough against the docs map.

## Dependencies
- Repository cleanup audit recommended but not strictly blocking.

## Risks
- Docs can become another duplicate tree if ownership and audience are unclear.

## Open Questions
- Should package-level docs under `packages/core/docs/user/` be moved under root `docs/`, or retained and linked as generated/package docs?

## Next Step
- Refine after the cleanup audit identifies canonical docs ownership.

## Engineering Handoff

- `change_summary`: Made `docs/README.md` the canonical audience-based documentation map for local operators, local-server admins, agent authors, contributors, internal workflow, and historical context. Linked the docs map from the root README. Reframed `packages/core/docs/README.md` as package-level docs with current agent-author paths and a clear legacy/needs-refresh section for older Athena/fleet/persona-era pages. Added a repo-wide docs pointer to the developer guides index.
- `validation_evidence`: Verified all linked first-stop files exist with shell path checks; ran stale-title scan against updated top-level docs; ran `./flywheel/tools/validate_workflow_state.sh --format json`; ran `git diff --check`.
- `qa_focus`: Confirm a new reader can choose the correct path for operator setup, local-server administration, agent authoring, and contributing from `docs/README.md`; confirm older package docs are visibly marked as legacy or needs-refresh rather than presented as canonical.
- `open_risks`: This story maps and labels the docs; it does not rewrite every stale package-level user page. Those refreshes remain follow-up work.

## Transition History
- `2026-05-30T03:47:56Z`: `intake` -> `active`; final evening docs IA story
- `2026-05-30T03:49:41Z`: `active` -> `qa`; documentation information architecture implemented
