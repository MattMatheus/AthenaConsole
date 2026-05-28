---
kind: story
id: STORY-20260528-quickstart-demo-docs-alignment
status: ready
owner_role: Software Engineer
source: epic
success_metric: Public-facing setup docs describe one accurate local startup and demo path.
release_scope: follow-up
ready: true
---

# Story: Quickstart Demo Docs Alignment

## Metadata
- `id`: STORY-20260528-quickstart-demo-docs-alignment
- `owner_role`: Software Engineer
- `status`: ready
- `source`: epic
- `decision_refs`: [ADR-0006]
- `epic`: docs/product/epics/refinement/2026.23.00-epic-operator-readiness-first-run.md
- `success_metric`: Public-facing setup docs describe one accurate local startup and demo path.
- `release_scope`: follow-up
- `pm_refinement`: Treat this as the closing documentation alignment story for the epic. It should verify README and product docs against the implemented readiness and sample demo behavior, without adding new product behavior.

## Problem Statement

The root README is becoming public-facing, but setup and demo instructions still need to converge around the real first-run path once readiness and sample demo behavior are implemented.

## Scope

- In: README/Getting Started/product docs alignment, expected commands and outputs, local-only caveats, link/path checks, internal roadmap/Flywheel reference cleanup.
- Out: marketing site launch, hosted docs publishing, screenshots unless explicitly scoped.

## Acceptance Criteria

1. Docs describe one canonical local startup, readiness check, and demo path.
2. Commands, URLs, expected readiness responses, and expected demo outputs match implemented behavior.
3. Public-facing docs explain the product without requiring Flywheel knowledge.
4. Internal roadmap and direction docs remain aligned with the Flywheel queue.
5. Links and file paths referenced by the quickstart are checked or explicitly marked as future/out of scope.

## Validation

- Required checks: docs consistency review against implemented readiness/sample behavior; link/path smoke check where practical; `./flywheel/tools/validate_workflow_state.sh`; `git diff --check`.

## Dependencies

- Recommended after readiness, sample demo, and console onboarding implementation.

## Risks

- Docs can drift quickly if they are not anchored to tested commands or explicit expected output.

## Next Step

Engineering should run this after readiness and sample demo are implemented, then update public docs and internal tracking in one closing pass.

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

## Transition History
- `2026-05-28T22:38:02Z`: `intake` -> `ready`; PM refinement complete for quickstart docs alignment
