<!-- AUDIENCE: Engineer/SDK -->

# SDK and Integration Guide

> Drafted in plans 031–032. This stub establishes the landing page; full content is authored in those plans.

Team Orchestrator exposes two integration surfaces for engineers and integrators:

1. **Agent Developer Kit (PDK)** — the `@athena/pdk` package for authoring plugin-backed agents. Covers plugin manifests, agent manifests, runtime implementation, permissions, inputs/outputs, and the scaffold command.

   Full guide: `agent-developer-kit.md` *(drafted in plan 031)*

2. **HTTP Control-Plane API Reference** — the REST API for creating and managing tasks, missions, workflow templates, runs, agents, providers, repositories, workspaces, and usage records.

   Full guide: `api/README.md` *(drafted in plan 032)*

---

## Quick Links (available now)

- Sample plugins: `sample-plugins/` — reference implementations for common patterns
- PDK package: `packages/pdk/` — source for `@athena/pdk`
- API health: `GET /api/v1/health`
- API readiness: `GET /api/v1/readiness`
