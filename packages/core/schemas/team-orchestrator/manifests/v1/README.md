# Team Orchestrator Manifest Schemas v1

This directory is the canonical source for reset-era Team Orchestrator manifest schemas.

- `plugin.schema.json` validates root `plugin.yaml` files.
- `agent.schema.json` validates referenced `*.agent.yaml` files.
- `workflow.schema.json` validates referenced `*.workflow.yaml` files.
- `examples/` contains validation fixtures for common plugin shapes.

Provider readiness is declared with manifest-compatible references, not raw secrets:

- Agents can declare `agent.runtime.modelProvider` with `required`, optional `providerId`, `providerKind`, `model`, and `label`.
- Workflows can declare `workflow.providerRequirements` as an array with the same fields. If omitted, workflow readiness is inferred from assigned agents.
- Provider configs and API keys remain app-state/runtime concerns; manifests reference only provider identity, kind, or model preferences.

Durable-memory access is default-deny unless a plugin or agent manifest declares it under `permissions.durableMemory`:

- Supported operations are `read`, `propose`, and `writeReviewed`.
- Each operation declares explicit `namespaces` and a `maxSensitivity` of `public`, `internal`, `sensitive`, or `secret-adjacent`.
- Namespace scopes are literal namespace IDs or a prefix ending in `/*`.
- Prefer `propose` over `writeReviewed` for examples; reviewed writes should stay narrow and operator-governed.

Schema versioning is explicit:

- Manifest documents use `schemaVersion: 1`.
- The schema directory path is versioned as `manifests/v1`.
- Breaking manifest changes should create a new versioned schema directory instead of editing v1 in place.

Ownership lives in `@athena/core` because these manifests define control-plane discovery, compatibility, safety, and observability contracts. Plugin loaders, console UI, and runtime adapters should consume these schemas instead of creating parallel manifest contracts.
