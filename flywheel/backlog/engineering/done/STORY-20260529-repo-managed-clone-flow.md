---
kind: story
id: STORY-20260529-repo-managed-clone-flow
status: done
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
- `status`: done
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

## Engineering Handoff

- `change_summary`: Added `managed-clone` creation through the connected repository API, including optional `workspacePath` request handling, managed clone destination resolution under `workspaceRoot/repos/managed`, local absolute path and HTTP(S) clone source validation, duplicate destination protection, post-clone inspection, and failed-clone records with `status: error` / `dirtyState: unknown`. Existing-path repository creation remains supported and still requires an absolute `workspacePath`.
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/api.connected-repositories.test.ts tests/api.schemas.test.ts tests/control-plane.domain-repositories.test.ts`; `npm --workspace @athena/core run check:schemas`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `qa_focus`: Verify managed clone creation from a local Git repository, failed clone status messaging, duplicate destination rejection, path-like ids staying under the managed root, existing-path compatibility, and unsupported SSH-style sources being rejected so no credential path is implied.
- `open_risks`: Public HTTPS clone support is implemented through the same Git CLI path but not exercised against the network in local tests. The service records failed clones clearly but does not attempt destructive cleanup of partial destination directories.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T03:34:19Z
- `evidence_quality`: strong
- `validation_evidence`: `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core exec -- vitest run tests/api.connected-repositories.test.ts tests/api.schemas.test.ts tests/control-plane.domain-repositories.test.ts`; `npm --workspace @athena/core run check:schemas`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
- `defects`: none
- `state_transition`: move to done
- `notes`: Story-focused API tests cover successful local managed clone creation, failed clone records, duplicate destination rejection, contained path-like ids, unsupported SSH-style clone source rejection, and existing-path compatibility. Public HTTPS support uses the same Git CLI clone path but was not network-tested locally.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T03:29:17Z`: `ready` -> `active`; Engineering starts repo managed clone flow
- `2026-05-29T03:33:30Z`: Engineering implementation completed; ready for QA.
- `2026-05-29T03:33:44Z`: `active` -> `qa`; Engineering handoff ready for QA
- `2026-05-29T03:34:19Z`: QA passed; ready for done.
- `2026-05-29T03:34:36Z`: `qa` -> `done`; QA passed for repo managed clone flow
