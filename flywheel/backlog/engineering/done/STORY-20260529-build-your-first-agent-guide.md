---
kind: story
id: STORY-20260529-build-your-first-agent-guide
status: done
owner_role: Software Engineer
source: epic
success_metric: Developers can follow one guide from empty plugin to loaded custom agent to successful run.
release_scope: next
ready: true
---

# Story: Build Your First Agent Guide

## Metadata
- `id`: STORY-20260529-build-your-first-agent-guide
- `owner_role`: Software Engineer
- `status`: done
- `source`: epic
- `decision_refs`: [ADR-0007, ADR-0008, ADR-0018]
- `epic`: docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
- `success_metric`: Developers can follow one guide from empty plugin to loaded custom agent to successful run.
- `release_scope`: next

## Problem Statement

The SDK/examples need a clear tutorial path so operators can build their own agents without reverse-engineering sample plugins.

## Initial Scope

- In: tutorial docs, plugin scaffold steps, manifest validation, local load path, agent catalog verification, first run.
- Out: CLI scaffolder, marketplace publishing, console-native authoring.

## Acceptance Criteria

1. Guide starts from an empty plugin directory and produces a valid plugin-backed agent.
2. Guide uses SDK helpers and explains which files are canonical manifests.
3. Guide shows how to validate manifests and load the plugin.
4. Guide shows how to confirm the agent in the console and run a task.
5. Guide explicitly says console authoring is not the normal path.

## Validation

- Docs command/path smoke.
- `npm --workspace @athena/core run validate:manifests`
- `git diff --check`
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

This should land after SDK and at least one useful example agent exist.

## Engineering Handoff

- `completed_at`: 2026-05-29T20:43:00Z
- `change_summary`: Replaced the stale persona-era PDK page with a current Build Your First Agent tutorial that starts from an empty local plugin directory, creates plugin and agent manifests, implements a PDK-backed runner, validates the package, loads it through `ATHENA_PLUGIN_PATHS`, confirms catalog visibility, creates a task, runs it, and inspects artifacts.
- `files_changed`:
  - `packages/core/docs/user/07-pdk-guide.md`
  - `packages/core/docs/README.md`
  - `docs/developer/product-dev-guides/04-extending.md`
  - `packages/pdk/package.json`
- `validation_evidence`: Tutorial command/path smoke, PDK tests, manifest validation, and whitespace validation passed.
  - Temporary `plugins/hello-agent` package created from the guide shape and validated with `validatePluginPackage`.
  - `npm --workspace @athena/pdk run build`
  - `npm --workspace @athena/core run build`
  - `node --input-type=module -e 'import { validatePluginPackage } from "@athena/core/control-plane/manifests/index"; ...'`
  - `npm --workspace @athena/pdk run test`
  - `npm --workspace @athena/core run validate:manifests`
  - `git diff --check`
- `qa_focus`: Confirm the guide satisfies the empty-plugin to loaded-agent to successful-run path, explains canonical manifest files, uses `@athena/pdk` helpers, includes manifest validation and load commands, names console catalog verification, and explicitly says console authoring is not the normal path.
- `open_risks`: The guide relies on a direct `validatePluginPackage` node command until a first-class plugin validation CLI exists.

## QA Verdict

- `verdict`: pass
- `qa_timestamp`: 2026-05-29T20:44:00Z
- `evidence_quality`: Fresh QA covered PDK tests, core build, manifest validation, direct manifest validator export smoke, guide acceptance-content search, and whitespace validation.
- `acceptance_coverage`:
  - AC1: The guide starts with `mkdir -p plugins/hello-agent/...` and builds `plugin.yaml`, `agents/hello.agent.yaml`, schema, docs, and runner files for a valid plugin-backed agent.
  - AC2: The runner imports `@athena/pdk`, uses the SDK helpers, and the guide names `plugin.yaml` and `agents/*.agent.yaml` as canonical manifest sources.
  - AC3: The guide shows `validatePluginPackage`, `validate:manifests`, `ATHENA_PLUGIN_PATHS`, API startup, and plugin catalog checks.
  - AC4: The guide tells the operator to confirm the agent at `/agents`, create a task through `/api/v1/tasks`, run it, and inspect `/api/v1/task-runs/<run-id>`.
  - AC5: The opening guidance states agents are not normally authored inside the console and that manifests/runner files remain the source of truth.
- `validation_evidence`: `npm --workspace @athena/pdk run test`; `npm --workspace @athena/core run build`; `npm --workspace @athena/core run validate:manifests`; `node --input-type=module -e 'import { validatePluginPackage } from "@athena/core/control-plane/manifests/index"; ...'`; `rg "mkdir -p plugins/hello-agent|@athena/pdk|validatePluginPackage|ATHENA_PLUGIN_PATHS|/agents|/api/v1/tasks|not normally authored inside the console" packages/core/docs/user/07-pdk-guide.md -n`; `git diff --check`.
- `defects`: None found.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
- `2026-05-29T20:37:55Z`: `ready` -> `active`; Engineering starts build your first agent guide
- `2026-05-29T20:41:41Z`: `active` -> `qa`; Engineering handoff for build your first agent guide
- `2026-05-29T20:43:04Z`: `qa` -> `done`; QA passed for build your first agent guide
