---
kind: story
id: STORY-20260530-docs-public-metadata-sweep
status: done
owner_role: Technical Writer
source: direct
success_metric: Public metadata and current docs consistently present Team Orchestrator as the current product.
release_scope: required
ready: false
---

# Story: Docs And Public Metadata Sweep

## Metadata
- `id`: STORY-20260530-docs-public-metadata-sweep
- `owner_role`: Technical Writer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0007, 0008, 0009]
- `success_metric`: Public metadata and current docs consistently present Team Orchestrator as the current product.
- `release_scope`: required

## Problem Statement

Several current-facing files still present old Project Athena, fleet, and persona-era language. This creates friction for new users even when the current user guide and root README describe Team Orchestrator correctly.

## Scope
- In: update root workspace package name, console package description, HTML title, `.env.example` header, `packages/core/src/README.md`, and stale package docs pointers; archive or label older `packages/core/docs/user/*` and `packages/core/docs/personas/*` pages.
- Out: renaming `@athena/*` package imports, `ATHENA_*` env vars, or CLI commands.

## Assumptions
- `docs/user-guide/README.md` is the canonical user guide.
- Historical docs should remain available when they explain old decisions, but not look current.

## Acceptance Criteria
1. Browser/package metadata says Team Orchestrator where user-visible.
2. Current docs do not send users to deleted planning paths.
3. Legacy docs are archived, labeled, or linked as compatibility-only.
4. Root docs and package docs agree on where a new operator or agent author should start.

## Validation
- Required checks: `rg "ProjectAthena|Project Athena|Athena Console|planning/backlog|planning/prompts"`, `git diff --check`.
- Additional checks: docs link review for updated paths.

## Dependencies
- Code retirement audit.

## Risks
- Over-renaming implementation names could create churn without product value; keep package/env compatibility names intact.

## Open Questions
- Should old package docs be archived wholesale or rewritten in place?

## Next Step
- Technical writing refinement should decide archive versus rewrite per docs subtree.

## Engineering Handoff
- `change_summary`: Updated user-visible product metadata and current-facing docs to present Team Orchestrator as the active product; labeled package-level persona/runtime docs as compatibility context; rewrote stale package docs references away from old Project Athena and Athena Console names while preserving real `athena` CLI and `ATHENA_*` compatibility interfaces.
- `validation_evidence`: `rg -n "ProjectAthena|Project Athena|Athena Console|planning/backlog|planning/prompts" package.json package-lock.json apps/console/package.json apps/console/package-lock.json apps/console/index.html packages/core/.env.example packages/core/src/README.md packages/core/docs docs/developer/product-dev-guides docs/README.md README.md GETTING_STARTED.md --glob '!**/dist/**'` returned no matches; `git diff --check` passed; `npm --workspace @athena/console run typecheck` passed; `./flywheel/tools/validate_workflow_state.sh --format json` passed.
- `qa_focus`: Confirm that new-user docs now point to repo-level user guide/getting-started paths, package docs are clearly compatibility-only, and no current-facing metadata still says Project Athena or Athena Console.
- `open_risks`: Historical CLI/env/package names intentionally remain unchanged for compatibility.

## QA Verdict
- `verdict`: Pass
- `evidence_quality`: Required stale-name/path scan returned no matches in the docs and metadata scope; whitespace check, console typecheck, and workflow validation passed.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-30T23:52:12Z`: `intake` -> `active`; activate next backlog story
- `2026-05-30T23:55:59Z`: `active` -> `qa`
- `2026-05-30T23:56:21Z`: `qa` -> `done`
