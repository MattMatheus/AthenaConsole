---
kind: story
id: STORY-20260529-run-readiness-gates
status: ready
owner_role: Software Engineer
source: epic
success_metric: Operators see missing repo, provider, agent, runtime, or permission requirements before starting real work.
release_scope: next
ready: true
---

# Story: Run Readiness Gates

## Metadata
- `id`: STORY-20260529-run-readiness-gates
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0013, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
- `success_metric`: Operators see missing repo, provider, agent, runtime, or permission requirements before starting real work.
- `release_scope`: next

## Problem Statement

Operators need clear pre-run feedback instead of discovering missing setup through failed runs.

## Initial Scope

- In: readiness service for task/workflow start, checks for repo/provider/agent/runtime/permissions, console display, blocked submission when required setup is missing.
- Out: mutation approval flow, server deployment diagnostics.

## Acceptance Criteria

1. Readiness checks identify missing or invalid repo context.
2. Readiness checks identify missing provider/secret configuration.
3. Readiness checks identify missing agent/workflow/runtime requirements.
4. Console shows actionable next steps before run.
5. Readiness payloads do not expose raw secret values.

## Validation

- Core readiness tests.
- Console tests for readiness state mapping if helpers are added.
- `npm --workspace @athena/core run typecheck`
- `npm --workspace apps/console run typecheck`
- Browser QA for blocked/ready states.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This should compose repo and provider readiness rather than duplicating their logic.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
