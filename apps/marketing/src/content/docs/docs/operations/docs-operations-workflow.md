---
title: Docs Operations Workflow
description: Lifecycle, ownership, and publishing flow for Team Orchestrator docs and blog content.
sidebar:
  order: 1
---

## Lifecycle states

All documentation and blog content follows four states:

1. **Draft**
2. **In Review**
3. **Published**
4. **Archived**

## Ownership baseline

- **Author** writes and updates content in the correct collection.
- **Reviewer** validates quality, product voice, and route stability.
- **Cycle owner** confirms build health and mandatory handoff updates.

## Publishing flow

### Docs

1. Update docs entries in `src/content/docs/`.
2. Verify section metadata (`section`, `sectionOrder`, `order`).
3. Run `npm run build`.
4. Merge to publish under `/docs/*`.

### Blog

1. Update posts in `src/content/blog/`.
2. Keep `draft: true` until review is complete.
3. Run `npm run build`.
4. Merge to publish under `/blog/*`.

## Canonical operational references

- Repository workflow reference: `internal-docs/developer/docs-as-code-workflow.md`
- Per-cycle checklist: `internal-docs/developer/cycle-checklist.md`
