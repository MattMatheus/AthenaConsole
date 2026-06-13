# Evidence Bundle V1

Evidence bundles are portable, redacted exports for completed work. They are intended for review, audit handoff, evaluation fixtures, and support investigations without requiring direct access to the Team Orchestrator app-state database.

## Contract

The TypeScript contract lives in `packages/core/src/shared/contracts/evidence-bundle.ts` and uses schema version `team-orchestrator.evidence-bundle.v1`.

A bundle contains:

- `manifest`: bundle id, creation metadata, source product/workspace, run metadata, redaction report, and checksums.
- `run`: task run metadata, optional task/workflow lineage, provider metadata, policy/approval state, and usage totals when available.
- `events`: redacted run events with per-entry checksums.
- `artifacts`: artifact metadata plus an inline payload, artifact reference, external reference, or unavailable reason.
- `memory`: durable-memory records, proposals, and approvals relevant to the run.

## Redaction

Exporters must call the shared redaction helper before writing portable bundle data. The v1 helper recursively replaces secret-shaped fields such as `apiKey`, `authorization`, `credential`, `password`, `secret`, `secretRef`, and `token` with `[redacted]`, and records every redacted JSON path in `manifest.redaction.redactedFields`.

Provider metadata may include provider id, kind, model, base URL, status, and a secret reference shape, but never a raw secret value. Connector tokens, provider keys, bearer headers, durable-memory auth tokens, and secret file contents must not appear in bundle JSON, artifact metadata, event payloads, memory entries, or checksums.

## Checksums

OBS-001B export code should compute SHA-256 checksums for:

- the canonical manifest JSON,
- each event entry,
- each artifact metadata/payload entry,
- each memory entry,
- inline artifact payloads when included.

Checksums prove bundle integrity, not authenticity. Signing can be added later without changing the v1 data model.

## Artifact Payloads

Artifact entries must preserve artifact metadata and identify payload availability:

- `inline-text` for small text payloads,
- `inline-json` for small JSON payloads,
- `artifact-ref` for payloads that stay in Team Orchestrator artifact storage,
- `external-ref` for external immutable references,
- `unavailable` with a reason when the payload cannot be exported.

Large payload export policy is intentionally deferred to OBS-001B.

## Scope Boundaries

V1 defines the portable schema and redaction model only. API routes, CLI commands, audit events, storage paths, and export permissions are implemented by later OBS-001 tasks.
