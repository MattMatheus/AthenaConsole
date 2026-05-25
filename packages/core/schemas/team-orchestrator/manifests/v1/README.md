# Team Orchestrator Manifest Schemas v1

This directory is the canonical source for reset-era Team Orchestrator manifest schemas.

- `plugin.schema.json` validates root `plugin.yaml` files.
- `agent.schema.json` validates referenced `*.agent.yaml` files.
- `examples/` contains validation fixtures for common plugin shapes.

Schema versioning is explicit:

- Manifest documents use `schemaVersion: 1`.
- The schema directory path is versioned as `manifests/v1`.
- Breaking manifest changes should create a new versioned schema directory instead of editing v1 in place.

Ownership lives in `@athena/core` because these manifests define control-plane discovery, compatibility, safety, and observability contracts. Plugin loaders, console UI, and runtime adapters should consume these schemas instead of creating parallel manifest contracts.
