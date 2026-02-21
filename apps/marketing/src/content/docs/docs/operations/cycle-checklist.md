---
title: Cycle Checklist
description: End-of-cycle checklist for documentation publishing and handoff discipline.
sidebar:
  order: 3
---

Use this checklist before every handoff.

## Checklist

- [ ] Story scope is complete and acceptance criteria are met.
- [ ] Lifecycle state for changed docs/blog content is explicit.
- [ ] Build passes with `npm run build`.
- [ ] Static smoke checks pass with `npm run check:static` (or `npm run validate:deploy`).
- [ ] Existing URLs remain stable.
- [ ] Handoff snapshot updated in `internal-docs/archive/handoff.md`.
- [ ] Completed stories moved from `internal-docs/backlog/active/` to `internal-docs/backlog/completed/`.
- [ ] Active backlog ordering updated for the next cycle.
- [ ] Seed prompt refreshed for the next cycle.
