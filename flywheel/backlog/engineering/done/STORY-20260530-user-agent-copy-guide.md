---
kind: story
id: STORY-20260530-user-agent-copy-guide
status: done
owner_role: Software Engineer
source: operator-testing
success_metric: A user can copy the model-provider smoke sample, rename it safely, restart the API, and run the new agent using documentation alone.
release_scope: next
ready: false
---

# Story: User Agent Copy Guide

## Metadata
- `id`: STORY-20260530-user-agent-copy-guide
- `owner_role`: Software Engineer
- `status`: done
- `source`: operator-testing
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: A user can copy the model-provider smoke sample, rename it safely, restart the API, and run the new agent using documentation alone.
- `release_scope`: next

## Problem Statement

The docs explain what an agent is, but they do not yet walk a user through the exact copy-and-rename path we validated with `local.user.test`.

## Initial Scope

- In: console Documentation page section, checked-in markdown guide, exact fields to change in `plugin.yaml`, agent manifest, runner artifact URI namespace, and README.
- Out: automated generator, interactive scaffolding, marketplace publishing.

## Acceptance Criteria

1. Documentation includes a "copy the sample agent" path with exact before/after field names.
2. The guide identifies plugin id, agent id, agent name, docs labels, and artifact URI namespace as copy-sensitive fields.
3. The guide includes API restart and catalog verification steps.
4. The guide includes a positive run test and a common duplicate-id failure explanation.
5. Documentation links to the model provider setup and task run flow.

## Validation

- `npm --workspace @athena/console run typecheck`
- `npm --workspace @athena/console run lint`
- Manual doc QA against `sample-plugins/local-user-test`.
- `git diff --check`

## Refinement Notes

Keep the guide action-oriented. Users should be able to skim it while editing files and then immediately verify in Agents and Tasks.

## Transition History
- `2026-05-30T03:14:17Z`: `intake` -> `active`; continue next engineering story

## Engineering Handoff

- `change_summary`: Added a checked-in copy-and-rename guide at `packages/core/docs/user/10-copy-sample-agent.md`, linked it from the public docs index and sample plugin READMEs, and added a console Documentation section that lists the copy-sensitive fields plus restart/catalog verification commands.
- `validation_evidence`: `npm --workspace @athena/console run typecheck`; `npm --workspace @athena/console run lint`; `npm --workspace @athena/console run test`; `npm --workspace @athena/core run validate:manifests`; manual doc QA with `rg` against `sample-plugins/local-user-test` and `sample-plugins/model-provider-smoke`; `git diff --check`.
- `qa_focus`: Verify the console Documentation page clearly tells a user to rename plugin id, agent id/name, docs labels, and artifact URI namespace; verify the markdown guide matches the checked-in `local-user-test` sample and includes restart, catalog, positive run, and duplicate-id troubleshooting steps.
- `open_risks`: This is documentation only; it does not add a generator or interactive scaffold, so users can still miss a rename if they skip the checklist.
- `2026-05-30T03:16:15Z`: `active` -> `qa`; copy sample agent guide implemented

## QA Verdict

- `verdict`: accepted
- `evidence_quality`: Console and manifest validation passed; operator completed the provider/agent setup loop successfully with the documented path.
- `defects`: none blocking
- `state_transition`: move to `done`
- `2026-05-30T03:28:15Z`: `qa` -> `done`; operator accepted user agent copy documentation
