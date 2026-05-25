<!-- AUDIENCE: Internal/Technical -->

# ADR 0008: Plugin Package Format

## Status

Accepted.

## Context

Team Orchestrator should include base agents while allowing additional agents and workflow templates to be installed locally. A plugin should support a workflow domain, not just one executable unit.

An agent can be distributed as a small single-agent plugin, but plugins should also be able to package multiple agents, workflow templates, schemas, docs, fixtures, tests, and optional UI metadata.

## Decision

A plugin is a local filesystem package with a required `plugin.yaml` at its root and optional canonical resource subdirectories.

Plugins are installed or loaded from local folders first. Remote registries, GitHub installation, and package-manager integrations are deferred.

One plugin may include many agents and workflow templates. A single agent may also be distributed as a small single-agent plugin, but the plugin remains the installable bundle.

## Package Layout

Recommended first layout:

```text
plugin-root/
  plugin.yaml
  agents/
    news-digest.agent.yaml
    transcript-summary.agent.yaml
  workflows/
    weekly-briefing.workflow.yaml
  schemas/
    news-digest-input.schema.json
  docs/
    README.md
  fixtures/
    sample-input.json
  tests/
    manifest.test.yaml
```

Only `plugin.yaml` is required. Known resource folders are canonical:

- `agents/`
- `workflows/`
- `schemas/`
- `docs/`
- `fixtures/`
- `tests/`

If a plugin includes first-class resources of one of these types, they should live in the corresponding folder.

## Plugin Manifest

The plugin manifest defines:

- plugin identity
- version
- display metadata
- explicit references to provided agents
- explicit references to provided workflow templates
- compatibility requirements
- permissions requested by default
- optional UI metadata
- documentation entry points

The loader should not auto-load arbitrary files simply because they exist in a canonical folder. `plugin.yaml` must explicitly reference included first-class resources.

## Loading Model

The app scans configured plugin directories, validates plugin manifests, validates referenced agent and workflow manifests, and indexes them into app state.

Plugin files remain filesystem-backed. Runtime app state stores the indexed view, load status, validation errors, and enablement state.

The first implementation should reference local plugins in place. Copying plugins into an app-managed install directory can be added later for stable user installation.

Plugin enablement is per workspace in the first version.

## Base Agents

Base agents ship as system plugins. They use the same plugin package shape and indexing path so product behavior stays consistent.

## Plugin Tests

Plugins may include test metadata, fixtures, and validation examples.

The first implementation should validate plugin and manifest shape plus sample fixtures where practical. Executing plugin test suites from the product is deferred.

## Consequences

Plugins become the natural distribution boundary for domain workflows such as software development, news aggregation, podcast processing, and document processing.

The plugin model keeps the product extensible without forcing every agent to be globally installed or individually managed.

## Open Questions

- What is the first canonical plugin search path?
- How should system plugins be versioned with the app?
- What metadata is required for optional plugin-specific UI panels?
