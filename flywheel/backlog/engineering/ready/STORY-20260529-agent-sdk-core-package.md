---
kind: story
id: STORY-20260529-agent-sdk-core-package
status: ready
owner_role: Software Engineer
source: epic
success_metric: Developers can build plugin-backed agents with a small SDK that handles standard envelopes, inputs, and artifacts.
release_scope: next
ready: true
---

# Story: Agent SDK Core Package

## Metadata
- `id`: STORY-20260529-agent-sdk-core-package
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Developers can build plugin-backed agents with a small SDK that handles standard envelopes, inputs, and artifacts.
- `release_scope`: next

## Problem Statement

Plugin-backed agents are powerful but too tedious to author without helper APIs and examples.

## Initial Scope

- In: SDK package, stdin task envelope parser, output envelope builder, artifact helper, input validation helper, mocked test harness helper.
- Out: console-native authoring, remote publishing, provider proxy.

## Acceptance Criteria

1. SDK package exports helpers for parsing task/run input envelopes.
2. SDK package exports helpers for producing valid agent run envelopes and artifacts.
3. SDK supports typed/structured input validation using current manifest-compatible schema shape.
4. SDK includes tests and a README with minimal agent example.
5. Existing manifest validation remains canonical; SDK does not replace manifests.

## Validation

- `npm --workspace @athena/core run typecheck` or package-specific typecheck if a new workspace is added.
- SDK unit tests.
- `npm --workspace @athena/core run validate:manifests`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Prefer a small package surface; avoid committing to broad framework abstractions.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
