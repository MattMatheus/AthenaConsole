---
kind: story
id: STORY-20260529-local-server-compose-profile
status: done
owner_role: Software Engineer
source: epic
success_metric: Operators can deploy Team Orchestrator on a local server with explicit persistent volumes and LAN-safe defaults.
release_scope: next
ready: true
---

# Story: Local Server Compose Profile

## Metadata
- `id`: STORY-20260529-local-server-compose-profile
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0010, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: Operators can deploy Team Orchestrator on a local server with explicit persistent volumes and LAN-safe defaults.
- `release_scope`: next

## Problem Statement

The next arc should prove Team Orchestrator can run somewhere more durable than a laptop dev server.

## Initial Scope

- In: compose profile or compose file for local-server deployment, persistent volumes for workspace/app-state/artifacts/repos/plugins/secrets, env template, LAN-safe comments/defaults.
- Out: internet-facing production, hosted auth, cloud provisioning.

## Acceptance Criteria

1. Server compose config defines explicit persistent storage for app-state, artifacts, managed repos, plugins, and secrets.
2. Config documents port exposure and LAN/local assumptions.
3. Config avoids raw production secrets in checked-in compose values.
4. Existing local development compose remains usable.
5. Docs explain host/container path ownership.

## Validation

- Compose config validation.
- Local container smoke where practical.
- Docs path smoke.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Land after repo/provider foundations so server deployment can use the same concepts.

## Engineering Handoff

- `change_summary`: Added `docker-compose.server.yml` for trusted-LAN/local-server deployment with explicit durable host mounts for workspace, SQLite app-state, artifact payload directories, managed repos, plugins, and read-only local secret files. Added `server.env.example`, local-server deployment docs, README/getting-started links, Git ignore rules for untracked server env/state, and `git` in the production API runtime image so managed clones work inside the container.
- `validation_evidence`: Parsed `docker-compose.local.yml`, `docker-compose.prod.yml`, and `docker-compose.server.yml` with the repo YAML parser; ran a focused Node structural assertion over `docker-compose.server.yml` for required services, auth posture, loopback bind default, absolute sandbox host path default, and persistent mounts; ran docs path smoke for state/artifacts/repos/plugins/secrets documentation; ran `git check-ignore -v .athena-server/state server.env`; ran `npm --workspace @athena/core run typecheck`; ran `git diff --check`; ran `./flywheel/tools/validate_workflow_state.sh`.
- `qa_focus`: Confirm server profile keeps API auth enabled, keeps published ports loopback-bound unless the operator opts into LAN binding, preserves existing `docker-compose.local.yml`, keeps real secret values out of checked-in compose/docs, and explains host/container path ownership for app-state, artifacts, repos, plugins, and secrets.
- `open_risks`: Live Compose config and container smoke could not run in this environment because `docker` is not installed and Podman cannot connect to a running socket. Docker-backed sandbox use requires `ATHENA_SERVER_DOCKER_SOCKET` and `ATHENA_SANDBOX_WORKSPACE_HOST_PATH` to match the server's container engine and host filesystem.

## QA Verdict

- `verdict`: Passed with environment-limited container smoke. The story acceptance criteria are met by the checked-in server compose profile, env template, docs, loopback/auth defaults, explicit host/container storage mapping, unchanged local dev compose, and absence of checked-in real secrets.
- `evidence_quality`: Good for static/config/docs validation. Live `docker compose config` and container start were not practical because `docker` is unavailable and Podman is not connected, so follow-up validation on a server with a running container engine is still recommended before relying on this for operations.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T21:33:29Z`: `ready` -> `active`; Engineering starts local server compose profile
- `2026-05-29T21:40:34Z`: `active` -> `qa`; Engineering handoff complete for local server compose profile
- `2026-05-29T21:41:27Z`: `qa` -> `done`; QA passed local server compose profile with container-engine limitation noted
