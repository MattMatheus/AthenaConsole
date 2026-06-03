<!-- AUDIENCE: Public/Internal -->

# Capability Pack Authoring

A capability pack is a normal Team Orchestrator plugin package that groups agents, workflow templates, docs, fixtures, and validation evidence around a useful capability area.

First-party bundled packs and user-authored local packs use the same manifest model. The bundled example at `bundled-plugins/software-team/` is the canonical fixture for this pattern.

## Pack Structure

Use this shape for a pack:

```text
my-capability-pack/
  plugin.yaml
  agents/
    my-agent.agent.yaml
  workflows/
    my-workflow.workflow.yaml
  fixtures/
    my-workflow.inputs.json
  docs/
    README.md
  scripts/
    optional-runner.mjs
```

Required for a useful pack:

- `plugin.yaml` with plugin identity, compatibility, permissions, `plugin.pack` metadata, and references to agents or workflows.
- At least one `agents/*.agent.yaml` file when the pack provides runnable work.
- At least one `workflows/*.workflow.yaml` file when the pack demonstrates a repeatable sequence.
- At least one deterministic JSON fixture under `fixtures/`.
- A `docs/README.md` that explains what the pack does and what setup it needs.

Optional:

- `schemas/` for task or workflow input schemas.
- `scripts/` for local deterministic runners.
- Additional docs, tests, or fixture variants.

## Pack Metadata

Pack metadata lives under `plugin.pack`:

```yaml
plugin:
  pack:
    category: software-team
    maturity: preview
    credentialRequirements:
      - none
    memoryRequirements:
      - none
    safety:
      posture: read-only
      externalWrites: false
      notes: Uses deterministic local fixtures and does not modify external systems.
    exampleWorkflows:
      - path: workflows/release-readiness.workflow.yaml
        id: bundled.software-team.release-readiness.workflow
        version: 0.1.0
```

Console mapping:

- `category` appears in pack filters and pack badges.
- `maturity` appears with the category in pack labels.
- `credentialRequirements` tells operators whether a model provider, connector account, local filesystem access, or no credential setup is expected.
- `memoryRequirements` tells operators whether durable memory is unused, read, proposed, reviewed-write, or semantic-search dependent.
- `safety.posture` and `safety.externalWrites` become safety requirement labels before an operator starts work.
- `exampleWorkflows` points to workflow templates that demonstrate the pack.

## Agents And Workflows

Agents should declare narrow capabilities and explicit limits. Prefer no-provider or mock-provider behavior for examples that are meant to run during local validation.

Workflows should assign tasks to pack agents when the sequence is intended to be smokeable:

```yaml
workflow:
  tasks:
    - id: review
      title: Review release readiness
      capabilityRequirements:
        - release.review
      assignedAgentId: bundled.software-team.release-readiness.local
      assignedAgentVersion: 0.1.0
```

Keep workflow inputs explicit so the console can render forms and fixture JSON can stay small.

## Fixtures

Fixtures should be deterministic and local. A workflow fixture can be as small as:

```json
{
  "workflowId": "bundled.software-team.release-readiness.workflow",
  "inputs": {
    "releaseName": "2026.1-fixture",
    "scope": "Confirm that the workflow can instantiate with deterministic local inputs."
  }
}
```

Avoid fixtures that depend on live third-party services unless the pack is specifically validating connector readiness. For provider-backed packs, keep a no-provider fixture for manifest and workflow validation where practical.

## Validation Checklist

Run these from the repository root:

```bash
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run validate:pack-fixtures
npm --workspace @athena/core run test:unit -- control-plane.plugin-loader.test.ts control-plane.manifests.test.ts
```

For console-facing metadata changes, also run:

```bash
npm --workspace @athena/console run typecheck
npm --workspace @athena/console run test
```

The pack fixture validator reports the affected pack name and the failing manifest, fixture, or workflow requirement.

## Local Installation

User-authored packs can live under any configured `ATHENA_PLUGIN_PATHS` directory, including `.athena/plugins/`.

First-party bundled packs live under `bundled-plugins/` and are indexed as system plugins through the default system plugin search path.

Do not bypass the plugin model for first-party packs. If a capability needs to appear in the console, make it a plugin-backed agent or workflow and let the catalog index it.
