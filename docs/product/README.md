<!-- AUDIENCE: Internal/Technical -->

# Product Docs

Durable product context for Team Orchestrator.

## Layout

```
direction/          — Product identity, UX philosophy, current direction
architecture/
  decisions/        — ADRs (canonical decision history)
epics/
  active/           — Upcoming and in-progress epics
  completed/        — Shipped epics (reference only)
roadmap/            — Flight path and future horizon
research/           — Active investigations
release/            — Release notes
```

## Start here

- `direction/current-direction.md` — what we're building now
- `architecture/decisions/` — why we made each structural choice
- `epics/active/` — what's next
- `roadmap/flight-path.md` — sequencing overview

## Retention rules

- ADRs are the canonical history. They don't expire.
- Epics move to `completed/` when shipped. They stay as lightweight reference.
- Point-in-time artifacts (audits, observer reports, old stories) live in git history, not on disk.
- Active work process belongs in `flywheel/`, not here.
