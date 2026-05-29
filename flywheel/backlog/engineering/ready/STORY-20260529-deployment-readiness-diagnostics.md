---
kind: story
id: STORY-20260529-deployment-readiness-diagnostics
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators can see whether a local-server deployment is ready to run real work.
release_scope: next
ready: true
---

# Story: Deployment Readiness Diagnostics

## Metadata
- `id`: STORY-20260529-deployment-readiness-diagnostics
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0018]
- `epic`: docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: Operators can see whether a local-server deployment is ready to run real work.
- `release_scope`: next

## Problem Statement

Server deployment needs visible readiness checks for storage, repos, plugins, providers, and runtimes.

## Initial Scope

- In: readiness checks for app-state, artifact storage, managed repo root, plugin paths, secret root/provider status, runtime backend, server exposure warnings, console display.
- Out: external monitoring stack, internet production posture.

## Acceptance Criteria

1. Readiness API reports server storage/resource checks without exposing secrets.
2. Console readiness surface shows pass/warn/fail for local-server requirements.
3. Diagnostics include actionable next steps.
4. Existing first-run readiness remains intact.
5. Server exposure warnings are clear when configuration is not LAN-safe.

## Validation

- Core readiness tests.
- Console typecheck/lint.
- Browser QA for diagnostics surface.
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Build on existing readiness services rather than creating a separate diagnostics system.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
