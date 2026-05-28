---
kind: story
id: STORY-20260528-quickstart-demo-docs-alignment
status: intake
owner_role: Software Engineer
source: epic
success_metric: Public-facing setup docs describe one accurate local startup and demo path.
release_scope: follow-up
ready: false
---

# Story: Quickstart Demo Docs Alignment

## Metadata
- `id`: STORY-20260528-quickstart-demo-docs-alignment
- `owner_role`: Software Engineer
- `status`: intake
- `source`: epic
- `decision_refs`: [ADR-0006]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: Public-facing setup docs describe one accurate local startup and demo path.
- `release_scope`: follow-up

## Problem Statement

The root README is becoming public-facing, but setup and demo instructions still need to converge around the real first-run path once readiness and sample demo behavior are implemented.

## Scope

- In: README/Getting Started/product docs alignment, expected commands and outputs, local-only caveats, link/path checks.
- Out: marketing site launch, hosted docs publishing, screenshots unless explicitly scoped.

## Acceptance Criteria

1. Docs describe one canonical local startup and demo path.
2. Commands, URLs, expected health responses, and expected demo outputs match implemented behavior.
3. Public-facing docs explain the product without requiring Flywheel knowledge.
4. Internal roadmap and direction docs remain aligned with the Flywheel queue.

## Validation

- Required checks: docs consistency review; link/path smoke check where practical; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`.

## Dependencies

- Recommended after readiness and sample demo implementation.

## Risks

- Docs can drift quickly if they are not anchored to tested commands or explicit expected output.

## Next Step

PM refinement should wait until the implemented readiness/sample path is clear, then scope exact docs to update.

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
