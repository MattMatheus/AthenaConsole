<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Planning Governance

This directory is the internal system of record for planning, architecture, delivery workflow, and agent-cycle execution.

Start with `planning/vision/current-direction.md` for the current product direction and roadmap. Older records in `planning/archive/` are historical context only.

## Canonical Ownership

- `planning/backlog/` owner: Product + Engineering leads.
  - Maintains active sequence order, story quality, acceptance criteria, and completion state.
- `planning/prompts/` owner: Agent operations owner (Engineering).
  - Maintains seed prompts and cycle directives that point to the next active story.
- `planning/developer/` owner: Engineering.
  - Maintains technical playbooks, standards, and implementation guides.
- `planning/architecture/` owner: Architecture group (Engineering leadership).
  - Maintains ADRs, system contracts, and long-lived design decisions.

Ownership is canonical: for each subtree above, only the listed owner group can approve structural changes.

## Audience Labeling Policy

Every Markdown document under `planning/` must begin with an audience header comment:

- `<!-- AUDIENCE: Internal/Technical -->`
- `<!-- AUDIENCE: Public/Marketing -->`

Use `Internal/Technical` by default. Use `Public/Marketing` only for public-track planning artifacts (typically `*.marketing.md`).

## `.marketing.md` Policy

`.marketing.md` files are a separate, public-facing planning track for website/content operations and messaging.

- They are not the source of truth for internal platform engineering execution.
- Internal execution artifacts must live in the non-marketing counterpart under `planning/`.
- If both variants exist, keep both only when they intentionally serve different audiences.
- If they become duplicates, remove the stale copy from `planning/archive/`.

## Cycle Handoff Protocol (Mandatory)

At the end of each development cycle, execute this order:

1. Validate deliverables against story acceptance criteria and record validation outcomes.
2. Truncate and rewrite `planning/vision/handoff.md` with only:
   - delivered changes,
   - validation status,
   - minimal context needed for the next story.
3. Move the completed story from `planning/backlog/active/` to `planning/backlog/completed/`.
4. Update `planning/backlog/active/README.md` so the top item is the next executable story.
5. Update `planning/prompts/active/next-agent-seed-prompt.md` so `Backlog Item` points to that next story.
6. If any artifact is superseded during the cycle, archive or delete it in the same change.

A cycle is incomplete until all six steps are done.

## Archive Hygiene

`planning/archive/` is for historical context only. Remove obsolete duplicates when they no longer add unique value.

## Directory Guide

- [**Current Direction**](vision/current-direction.md) - Product direction, delivered baseline, and roadmap.
- [**Backlog**](backlog/active/README.md) - Prioritized implementation queue.
- [**Architecture Decisions**](architecture/0006-team-orchestrator-direction-and-agent-model.md) - ADRs and design records.
- [**Developer Guides**](developer/01-architecture.md) - Engineering workflows and technical standards.
- [**Research**](research/README.md) - Research queue status and retained investigations.
- [**Archive**](archive/README.md) - Historical records and retained legacy artifacts.
- [**Prompts**](prompts/active/next-agent-seed-prompt.md) - Agent-cycle directives.

---

For public user docs, see `docs/README.md`.
