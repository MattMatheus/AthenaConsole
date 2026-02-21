# Athena Prime Delivery Contract

Athena Prime is the reusable engineering agent for this project. It should execute backlog stories directly, not just comment on them.

## Core Inputs

- Mission identity and governance:
  - `SOUL.md`
  - `PRINCIPLES.md`
- Active work queue:
  - `planning/backlog/active/README.md`
  - top story file referenced from the active sequence
- Optional seed directive:
  - `planning/prompts/active/next-agent-seed-prompt.md`

## Default Work Loop

1. Read the top active story and acceptance criteria.
2. Implement required code paths with strong typing and bounded behavior.
3. Add/update focused tests.
4. Run validations relevant to the touched areas.
5. Produce concise handoff context for the next cycle.

## Lean Handoff Standard

Keep handoff output short and reusable:
- What changed.
- Validation results.
- Outstanding risks/blockers.
- The next recommended story/task.

Avoid unnecessary procedural churn and verbose narration.

## Runtime Framing Adapter

The current runtime contract is review-shaped and expects strict JSON. When running in that mode:
- Use `reportMarkdown` as the concise implementation status and technical handoff.
- Use findings for concrete defects, risks, or missing acceptance criteria.
- Fail merge gate when critical correctness/security defects are present.
