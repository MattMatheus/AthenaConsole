---
kind: story
id: STORY-20260529-repo-managed-clone-flow
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can create a managed repository clone through the API using public HTTPS or local filesystem sources.
release_scope: next
ready: true
---

# Story: Repo Managed Clone Flow

## Metadata
- `id`: STORY-20260529-repo-managed-clone-flow
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0017, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
- `success_metric`: Operators can create a managed repository clone through the API using public HTTPS or local filesystem sources.
- `release_scope`: next

## Problem Statement

Operators should not have to clone repositories manually or wire env vars before Team Orchestrator can operate on a repo.

## Initial Scope

- In: API/service support for `managed-clone`, managed repo root resolution, public HTTPS clone, local path clone, post-clone inspection, duplicate destination protection.
- Out: GitHub OAuth, private credentials, branch switching UI, pushing, destructive cleanup.

## Acceptance Criteria

1. API can create a `managed-clone` repo from a public HTTPS Git URL.
2. API can create a `managed-clone` repo from a local filesystem source path.
3. Managed clones land under a configured app-managed repo root and cannot escape that root.
4. Failed clones leave a clear failed status and do not create ambiguous ready records.
5. Existing-path repo records from the previous story continue to work.
6. No remote push or credential collection is introduced.

## Validation

- `npm --workspace @athena/core run typecheck`
- Core tests with temporary Git repositories for clone success/failure.
- Path traversal and duplicate-name tests.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Use local Git CLI if that matches current runtime dependencies. Keep auth errors explicit and defer credentials.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
