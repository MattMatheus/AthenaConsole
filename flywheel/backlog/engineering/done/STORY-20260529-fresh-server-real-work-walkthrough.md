---
kind: story
id: STORY-20260529-fresh-server-real-work-walkthrough
status: done
owner_role: Software Engineer
source: epic
success_metric: A fresh local server can be brought up, configured, and used for one useful repo run by following documented steps.
release_scope: next
ready: true
---

# Story: Fresh Server Real-Work Walkthrough

## Metadata
- `id`: STORY-20260529-fresh-server-real-work-walkthrough
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0018]
- `epic`: docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: A fresh local server can be brought up, configured, and used for one useful repo run by following documented steps.
- `release_scope`: next

## Problem Statement

The arc needs an end-to-end proof that the product can do real work on a durable local server.

## Initial Scope

- In: docs walkthrough from fresh server checkout to compose up, provider setup, repo connection, example agent load, useful run, artifact inspection, backup/restore notes.
- Out: public internet deployment, team auth, cloud provisioning.

## Acceptance Criteria

1. Walkthrough starts from a clean local-server target and names prerequisites.
2. Walkthrough configures persistent volumes and secrets safely.
3. Walkthrough connects a repo and provider or documented mock alternative.
4. Walkthrough runs a useful example agent and inspects artifacts.
5. Walkthrough includes basic stop/backup/restore notes.

## Validation

- Docs command/path smoke.
- Compose smoke if feasible in local environment.
- Browser QA for referenced console paths if changed.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This should be last in the arc, once the product can prove the loop honestly.

## Engineering Handoff

- `change_summary`: Added a fresh-server real-work walkthrough covering durable host paths, server env setup, plugin seeding, safe local-file provider secrets, authenticated readiness checks, repo connection, repo-summary task execution, artifact inspection, and stop/backup/restore notes; linked it from the developer guide index, local-server deployment guide, and README.
- `validation_evidence`: Docs path smoke for referenced files; markdown content smoke for key commands/API paths; YAML/JSON parse smoke for referenced compose/plugin/schema files; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`; attempted compose config smoke with Docker and Podman.
- `qa_focus`: Confirm the runbook starts from a clean server, keeps secrets out of committed files, uses durable volumes, documents both provider setup and mock/no-provider path, runs useful repo-summary work, and includes recovery notes.
- `open_risks`: Docker is unavailable and Podman socket is not running in this local environment, so live compose config/container smoke could not be completed here.

## QA Verdict

- `verdict`: pass
- `evidence_quality`: Documentation path/content smoke covered all referenced repo files, key API paths, server paths, and guide links; structured YAML/JSON parse smoke covered the compose file and referenced sample plugin assets; `git diff --check` and Flywheel validation passed. Compose execution remains environment-blocked because neither Docker nor a running Podman socket is available.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T21:54:50Z`: `ready` -> `active`; Engineering starts fresh server real-work walkthrough
- `2026-05-29T21:58:23Z`: `active` -> `qa`; Engineering handoff ready for fresh server walkthrough QA
- `2026-05-29T21:58:51Z`: `qa` -> `done`; QA passed fresh server real-work walkthrough
