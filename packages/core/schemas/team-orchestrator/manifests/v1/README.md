# Team Orchestrator Manifest Schemas v1

This directory is the canonical source for reset-era Team Orchestrator manifest schemas.

- `plugin.schema.json` validates root `plugin.yaml` files.
- `agent.schema.json` validates referenced `*.agent.yaml` files.
- `workflow.schema.json` validates referenced `*.workflow.yaml` files.
- `examples/` contains validation fixtures for common plugin shapes.

First-party capability packs are ordinary plugin packages with optional `plugin.pack` metadata:

- `category` identifies the broad pack family: `software-team`, `research`, `knowledge-work`, `operations`, `connector`, or `example`.
- `maturity` is one of `experimental`, `preview`, or `stable`.
- `credentialRequirements` declares operator setup needs such as `none`, `model-provider`, `connector-account`, or `local-filesystem`.
- `memoryRequirements` declares durable-memory needs such as `none`, `read`, `propose`, `write-reviewed`, or `semantic-search`.
- `safety` declares the operator-facing posture, whether external writes are possible, and any approval notes.
- `exampleWorkflows` can point at workflow templates that demonstrate the pack.

User-authored plugins may omit `plugin.pack`. First-party bundled packs should include it so the console can group packs, explain setup needs, and show safety expectations without hardcoding individual plugin IDs.

Bundled pack fixtures should be deterministic and local:

- Include at least one JSON file under `fixtures/` with representative workflow or agent inputs.
- Include at least one workflow template when the pack can be smoked without external credentials.
- Keep fixture assertions stable; validate IDs, manifest shape, fixture parseability, and workflow availability instead of generated prose.
- Use mock providers or no-provider agents for first-party smoke examples unless the pack specifically tests provider readiness.

Run `npm --workspace @athena/core run validate:pack-fixtures` to validate bundled pack metadata, manifests, fixtures, and smokeable workflow references.

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
