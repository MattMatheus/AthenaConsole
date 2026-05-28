<!-- AUDIENCE: Internal/Technical -->

# 2026 Planning Cleanup Stale Records Archive

This archive contains planning records moved out of the active/current planning lanes during the Team Orchestrator planning cleanup.

## Why These Moved

The planning tree mixed current Team Orchestrator execution records with older ProjectAthena, Foundry-first, fleet-governance, persona-kit, A2A-observability, and research/testing artifacts. That made it unclear where active user stories came from.

The current source of truth is now:

- `planning/vision/current-direction.md`
- `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md` through `planning/architecture/0014-scheduling-model.md`
- `planning/backlog/refinement/2026.10.00-epic-team-orchestrator-foundation-reset.md` and later reset-aligned epics
- `planning/backlog/active/README.md`
- `planning/prompts/active/next-agent-seed-prompt.md`

## Contents

- `architecture/`: pre-reset architecture/design records.
- `backlog/completed-pre-reset/`: completed stories from the older product direction.
- `backlog/deferred/`: deferred stories that predate the reset and require re-triage.
- `backlog/release-001/`: older Release 001 completion records.
- `backlog/post-release-001/`: older post-Release 001 completion records.
- `backlog/refinement-pre-reset/`: refinement epics/stories that were not rewritten against Team Orchestrator.
- `backlog/testing/`: older testing backlog records.
- `developer/`: pre-reset docs/content, analytics, deployment, GitHub Actions, AppInsights, and docs-sync records.
- `marketing/`: public/marketing planning variants from the older website/docs-as-code track.
- `research-active/`: stale active research queue entries.

## Restoration Rule

Do not move files from this archive back into active planning directly. If an idea is still valuable, rewrite it as a current `2026.xx.00` epic or `2026.xx.yy` story with source decisions, acceptance criteria, and validation expectations.
