# Team Orchestrator Core Agent Guide

Team Orchestrator is no longer centered on the legacy Azure/cloud fleet roadmap. Core work should follow the current local-first, enterprise-capable direction documented in the repository root `AGENTS.md` and the accepted ADRs under `docs/product/architecture/decisions/`.

Current implementation stage: Stage 8 (in progress).

For `packages/core`, prioritize:

- local-first defaults with server-ready boundaries,
- manifest-backed plugins and agents,
- SQLite app-state repositories without SQLite-only assumptions in shared contracts,
- task/mission/run/event/artifact domain contracts,
- workspace, RBAC, usage/cost, and durable-memory domain contracts,
- pluggable runtime backends,
- API surfaces needed by the web console.

Backward compatibility with the legacy fleet/persona direction is not required unless the active story explicitly asks for it.
