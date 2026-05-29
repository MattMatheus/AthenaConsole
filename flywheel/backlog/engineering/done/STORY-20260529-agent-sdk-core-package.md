---
kind: story
id: STORY-20260529-agent-sdk-core-package
status: done
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
- `status`: done
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

## Engineering Handoff

- `completed_at`: 2026-05-29T20:25:00Z
- `change_summary`: Added a small agent-facing SDK layer to `@athena/pdk` for task/run envelope parsing, manifest-shaped input validation, run output/artifact construction, and handler-level unit testing.
- `files_changed`:
  - `packages/pdk/src/agent.ts`
  - `packages/pdk/src/index.ts`
  - `packages/pdk/package.json`
  - `packages/pdk/tests/agent-sdk.test.mjs`
  - `packages/pdk/README.md`
- `validation_evidence`: PDK typecheck, SDK unit tests, core typecheck, manifest validation, whitespace validation, and Flywheel workflow validation passed.
  - `npm --workspace @athena/pdk run typecheck`
  - `npm --workspace @athena/pdk run test`
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core run validate:manifests`
  - `git diff --check`
  - `./flywheel/tools/validate_workflow_state.sh`
- `qa_focus`: Confirm the exported SDK helpers cover parsing, validation, output/artifact creation, and handler tests. Confirm README positions manifest validation as canonical and does not imply console-native agent authoring.
- `open_risks`: The SDK validates the current manifest-compatible input field shape but intentionally does not perform external JSON Schema validation for referenced field schemas.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:28:00Z
- `evidence_quality`: Fresh package-level QA covered PDK typecheck, SDK unit tests, review of the exported SDK surface, core typecheck, manifest validation, whitespace validation, and Flywheel workflow validation.
- `acceptance_coverage`:
  - AC1: `parseAgentTaskRunEnvelope` parses JSON/stdin-compatible task, agent, and run envelopes.
  - AC2: `createAgentRunOutput`, `createAgentArtifact`, and `serializeAgentRunOutput` produce valid task-run output envelopes.
  - AC3: `parseAgentInputs` and `parseAgentEnvelopeInputs` validate the current manifest-compatible `agent.inputs` field shape, including required fields, defaults, primitive types, arrays, objects, and enum values.
  - AC4: `packages/pdk/tests/agent-sdk.test.mjs` covers the SDK surface and `packages/pdk/README.md` includes a minimal agent example.
  - AC5: README compatibility boundaries state that manifest validation remains canonical and the SDK does not replace manifests.
- `validation_evidence`: `npm --workspace @athena/pdk run typecheck`; `npm --workspace @athena/pdk run test`; `npm --workspace @athena/core run typecheck`; `npm --workspace @athena/core run validate:manifests`; `git diff --check`; `./flywheel/tools/validate_workflow_state.sh`.
  - `npm --workspace @athena/pdk run typecheck`
  - `npm --workspace @athena/pdk run test`
  - `npm --workspace @athena/core run typecheck`
  - `npm --workspace @athena/core run validate:manifests`
  - `git diff --check`
- `defects`: None found.
- `state_transition`: Move to `done`.
- `notes`: Browser QA was not required; this story changes package APIs, tests, and documentation only.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:11:31Z`: `ready` -> `active`; Engineering starts agent SDK core package
- `2026-05-29T20:16:04Z`: `active` -> `qa`; Engineering handoff complete for agent SDK core package
- `2026-05-29T20:16:27Z`: `qa` -> `done`; QA passed for agent SDK core package
