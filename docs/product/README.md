<!-- AUDIENCE: Internal/Technical -->

# Product Docs

Durable product context for Team Orchestrator.

## Layout

```
direction/          — Current identity, run quality model, and archived historical notes
architecture/
  decisions/        — ADRs (canonical decision history)
epics/
  active/           — Upcoming and in-progress epics
  completed/        — Shipped epics (reference only)
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
- Epics move to `completed/` when shipped. They stay as lightweight reference.
- Point-in-time artifacts, observer reports, and old completed Flywheel stories live under `flywheel/archive/` when they need to remain available on disk.
- Completed implementation plans live under `plans/archive/`.
- Active work process belongs in `flywheel/`, not here.
