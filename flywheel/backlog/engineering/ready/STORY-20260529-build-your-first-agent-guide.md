---
kind: story
id: STORY-20260529-build-your-first-agent-guide
status: ready
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
- `status`: ready
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

## Transition History
- `2026-05-29T03:08:43Z`: PM refinement created ready engineering story
