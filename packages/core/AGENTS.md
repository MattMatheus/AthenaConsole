# Team Orchestrator Core Agent Guide

Team Orchestrator is no longer centered on the legacy Azure/cloud fleet roadmap. Core work should follow the reset direction documented in the repository root `AGENTS.md` and the accepted ADRs under `planning/architecture/`.

Current implementation stage: Stage 8 (in progress).

For `packages/core`, prioritize:

- local-first defaults,
- manifest-backed plugins and agents,
- SQLite app-state repositories,
- task/mission/run/event/artifact domain contracts,
- pluggable runtime backends,
- API surfaces needed by the web console.

Backward compatibility with the legacy fleet/persona direction is not required unless the active story explicitly asks for it.
