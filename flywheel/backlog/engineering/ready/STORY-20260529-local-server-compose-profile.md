---
kind: story
id: STORY-20260529-local-server-compose-profile
status: ready
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
- `status`: ready
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

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
