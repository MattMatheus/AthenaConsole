---
kind: story
id: STORY-20260530-in-product-documentation-guide
status: done
owner_role: Product Engineer
source: planning
success_metric: The console Documentation page teaches the core product model and workflows without requiring users to read repository docs or source code.
release_scope: required
ready: true
---

# Story: In-Product Documentation Guide

## Metadata
- `id`: STORY-20260530-in-product-documentation-guide
- `owner_role`: Product Engineer
- `status`: done
- `source`: planning
- `decision_refs`: [0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016]
- `success_metric`: The console Documentation page teaches the core product model and workflows without requiring users to read repository docs or source code.
- `release_scope`: required

## Problem Statement

The repo now has a comprehensive guide, but users should not have to leave the product and read repository files to learn Team Orchestrator. The existing in-product Documentation page is too narrow and mostly agent-authoring focused. It needs to become a real product learning surface.

## Scope
- In: reshape `/docs` into an in-product guide covering product purpose, concepts, first-run demo, real repo work, providers, agent authoring, inspection, troubleshooting, glossary, and next actions.
- Out: new runtime behavior, screenshots, external hosted docs, repository guide removal.

## Acceptance Criteria
1. `/docs` starts with a plain-language product explanation and core mental model.
2. The page includes operator workflows for first-run demo, real repo work, provider setup, running work, and inspecting outputs.
3. The page includes an agent-author path using the scaffold command and manifest/runner concepts.
4. The page includes troubleshooting and glossary content inside the console.
5. The page links to relevant console surfaces instead of assuming repository navigation.
6. Console validation and browser QA pass.

## Validation
- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run test`
- `./flywheel/tools/validate_workflow_state.sh --format json`
- `git diff --check`
- Browser QA of `/docs` at desktop and mobile widths.

## Risks
- The page can become too dense if it only mirrors repo docs; structure should favor scan-friendly sections and product routes.
- Code examples must not overflow or break mobile layout.

## Engineering Handoff

- `change_summary`: Replaced the narrow agent-authoring `/docs` content with an in-product Team Orchestrator guide. The page now explains the product purpose, core concepts, first-run demo, real repo work, provider setup, agent authoring, inspectability, product smoke, troubleshooting, glossary, and next paths with links to console surfaces.
- `validation_evidence`: `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run test`; `npm --workspace @athena/console run lint`; `./flywheel/tools/validate_workflow_state.sh --format json`; `git diff --check`; in-app browser QA for `/docs` at desktop/default width and 390px mobile width, with no console errors and no horizontal overflow.
- `qa_focus`: Confirm `/docs` is useful without reading repository files, teaches the product model instead of only agent copy mechanics, links to product surfaces, and remains usable on mobile.
- `open_risks`: This is an in-app text guide, not a screenshot-rich or interactive tutorial. User testing should decide whether to add guided walkthroughs next.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: Required checks passed: `npm --workspace @athena/console run typecheck`, `npm --workspace @athena/console run test`, `npm --workspace @athena/console run lint`, `./flywheel/tools/validate_workflow_state.sh --format json`, `git diff --check`, and in-app browser QA for `/docs` at default and 390px mobile widths with no console errors or horizontal overflow.
- `defects`: None found.
- `state_transition`: Ready for engineering done.

## Transition History
- `2026-05-30T23:27:00Z`: created active story from operator feedback that docs must live inside the product.
- `2026-05-30T23:26:04Z`: `active` -> `qa`; in-product documentation guide handoff ready
- `2026-05-30T23:26:37Z`: `qa` -> `done`; QA passed in-product documentation guide
