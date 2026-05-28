<!-- AUDIENCE: Internal/Technical -->

# Personas

## Reset Note

These role/persona prompt documents are legacy implementation context. Future agent definitions should move toward formal manifest-backed agents and plugins as described in `planning/architecture/0006-team-orchestrator-direction-and-agent-model.md`.

Personas are repo-local agent definitions that describe what an Athena run should do and how it should behave.

They are intentionally separate from the core runtime so:

- The Athena runtime can remain generic and stable.
- Teams can version agent behavior alongside the codebase being operated on.
- The same persona can be executed via different runners (local CLI, container, future orchestration) using the same run contract.

## Location

Persona definitions live under the repo root `personas/`.

Examples:

- `personas/code-review.json`
- `personas/code-review/` (curated prompt/skill/doc context files)
- `personas/code-review/persona.json` (nested definition file, additive compatibility path)

## Available Personas

- `code-review`: see `docs/personas/code-review.md`
