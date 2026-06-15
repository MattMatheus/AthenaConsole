<!-- AUDIENCE: Internal/Technical -->

# Product Docs

Durable product context for Team Orchestrator.

## Layout

```
direction/          — Current identity, run quality model
architecture/
  decisions/        — ADRs (canonical decision history)
epics/
  active/           — Upcoming and in-progress epics
roadmap/            — Flight path, future horizon, enterprise readiness
research/           — Active investigations
release/            — Release notes
pilot/              — Pilot packaging, demo, and adoption guidance
```

## Start here

- `direction/current-direction.md` — what we're building now
- `architecture/decisions/` — why we made each structural choice
- `architecture/decisions/0027-enterprise-multi-user-direction.md` — accepted enterprise/multi-user direction
- `epics/active/` — what's next
- `roadmap/flight-path.md` — sequencing overview
- `roadmap/future-horizon.md` — post-2026.1 capability and enterprise horizon

## Retention rules

- ADRs are the canonical history. They don't expire.
- Completed epics are retained in git history (removed from disk at commit `9acdfd6`). Completed arcs are summarized in prose in `roadmap/flight-path.md`.
- Point-in-time artifacts, observer reports, and old completed Flywheel stories live under `flywheel/archive/` when they need to remain available on disk.
- Completed implementation plans live under `plans/archive/`.
- Active work process belongs in `flywheel/`, not here.
