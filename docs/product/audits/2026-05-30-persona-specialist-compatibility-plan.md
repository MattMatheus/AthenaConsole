# Persona And Specialist Compatibility Plan

Date: 2026-05-30

## Decision

Persona and specialist runtime paths are compatibility surfaces, not the current Team Orchestrator authoring model. New agent authoring should use manifest-backed plugin agents, the Agent Developer Kit, workflow templates, tasks, and missions.

Keep compatibility where it protects old local workflows or persisted artifacts. Retire or migrate checked-in assets that still act like current guidance.

## Classification

| Surface | Current status | Decision | Migration path |
| --- | --- | --- | --- |
| `POST /api/v1/specialists/run` | Active compatibility API | Retain for one compatibility window | Add deprecation metadata and point callers to plugin-backed task/workflow execution. |
| `POST /api/v1/personas/run` | Alias to specialist run | Deprecate alias | Keep route until the compatibility window closes, then remove after warning telemetry confirms low/no use. |
| `GET /api/v1/specialists` | Active compatibility listing API | Retain as compatibility | Label docs/API metadata as compatibility; do not promote in current quickstarts. |
| `GET /api/v1/personas` | Alias to specialist listing | Deprecate alias | Same removal path as `personas/run`. |
| `athena specialist ...` | Active compatibility CLI | Retain as maintenance-only | Add CLI deprecation/help copy that points new agent authors to plugin manifests and ADK examples. |
| `athena persona ...` | Alias to specialist CLI | Deprecate alias | Keep short-term alias; add warning/help text; remove in a future breaking-change story. |
| `packages/core/src/personas/*` | Main implementation for specialist compatibility | Retain internally | Keep implementation stable while plugin-agent execution becomes the primary path. Rename only in a dedicated breaking-change migration. |
| `packages/core/src/specialists/*` | Re-export facade over persona runtime | Retain compatibility facade | Keep as the preferred compatibility name while avoiding new public docs that teach prose personas first. |
| `packages/pdk` persona helpers (`definePersona`, `PersonaTestHarness`) | Useful tests/helpers with old naming | Retain as compatibility exports | Move docs under compatibility notes; future package version can introduce `compat/persona` exports. |
| `.athena/specialist-runs` artifacts | Current compatibility artifact root | Retain | Continue reading for historical run review until task/run artifacts fully supersede it. |
| `.athena/persona-runs` artifacts | Legacy compatibility copy/fallback | Deprecate | Preserve read fallback; stop writing duplicate copies in a future migration after artifact migration guidance exists. |
| `specialists/code-review` | Useful sample specialist | Migrate | Convert into a plugin-backed sample agent, then archive/remove the specialist asset. |
| `specialists/athena-prime` | Product-internal specialist with stale planning-path assumptions | Retire/archive | Archive as historical context or remove after confirming no active tests/docs require it. |
| `packages/core/docs/personas/*` | Package-level compatibility docs | Retain as labeled compatibility docs | Keep behind compatibility label; remove once code-review sample migrates. |
| Event payload fields `personaName`/`specialistName` | Persisted metadata compatibility | Retain readers | Prefer `agentName` in new contracts while reading old fields for historical data. |

## Follow-Up Story Proposals

### Migrate Code Review Specialist To Plugin Agent

As an agent author, I want the code-review example to be a manifest-backed plugin agent so that new users learn the current Team Orchestrator authoring model.

Acceptance:
- A plugin-backed code-review sample exists under the current plugin/agent examples.
- Current docs point to the plugin sample, not `specialists/code-review`.
- The old specialist asset is archived or labeled as compatibility-only.
- Existing compatibility tests remain green until the asset is removed.

Validation:
- Manifest validation passes.
- Focused sample/plugin tests pass.
- `rg "specialists/code-review"` review shows only compatibility/archive references.

### Deprecate Persona API And CLI Aliases

As a maintainer, I want persona aliases to emit clear compatibility/deprecation guidance so that old users are not broken and new users do not copy old commands.

Acceptance:
- `/api/v1/personas` and `/api/v1/personas/run` are marked deprecated with canonical specialist/plugin-agent guidance.
- `athena persona ...` prints help/deprecation copy that points to current agent/plugin workflows.
- Tests cover alias behavior and deprecation metadata/copy.

Validation:
- Focused API route/schema tests pass.
- Focused CLI tests pass.
- Docs search confirms current quickstarts do not promote persona aliases.

### Retire Athena Prime Specialist Asset

As a maintainer, I want the stale `specialists/athena-prime` asset retired or archived so that deleted planning paths are not treated as active agent instructions.

Acceptance:
- `specialists/athena-prime` is either removed or moved to a dated archive.
- Any remaining reference labels it as historical context.
- Tests no longer require the active asset path.

Validation:
- Manifest/example tests pass.
- `rg "athena-prime|planning/backlog|planning/prompts"` shows no active guidance references outside archives/tests.

### Move PDK Persona Helpers Behind Compatibility Docs

As an ADK user, I want the PDK public docs to lead with manifest-backed agents while persona helpers are clearly marked as compatibility utilities.

Acceptance:
- `packages/pdk/README.md` leads with current plugin/agent APIs.
- `definePersona` and `PersonaTestHarness` remain exported, but are documented under compatibility.
- A future breaking-change note describes a `compat/persona` export path.

Validation:
- PDK tests pass.
- Docs search confirms persona helpers are not the first-stop API for new users.
