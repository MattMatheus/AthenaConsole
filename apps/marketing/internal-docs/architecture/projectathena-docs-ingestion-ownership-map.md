# ProjectAthena Docs Ingestion Ownership Map

Story: `02.03-establish-docs-ingestion-manifest-and-ownership-map`

## Purpose

Define ownership and review responsibilities for Athena docs imported into TeamOrchestrator.com and formalize route-stability policy for published slugs.

## Manifest Contract

- Manifest file: `internal-docs/architecture/projectathena-docs-ingestion-manifest.json`
- Schema file: `internal-docs/architecture/projectathena-docs-ingestion-manifest.schema.json`
- Canonical source repo for mapped pages: `projectathena/docs`

Required entry fields:

- `sourcePath`: canonical file path inside `projectathena/docs`
- `destinationSlug`: stable website slug segment for `/docs/<destinationSlug>/`
- `owner`: owning team plus required reviewer handles
- `lifecycleState`: one of `draft`, `in_review`, `published`, `archived`

## Slug Lock Policy

1. Once a mapped page reaches `published`, `destinationSlug` is immutable.
2. If upstream source files are renamed/moved, only `sourcePath` changes in manifest.
3. If upstream source files are removed:
   - Keep generated website route for one deprecation cycle.
   - Add replacement/deprecation notice.
   - Archive only after replacement path is available (or deprecation window closes).
4. Slug collisions are invalid and must fail ingestion validation in Story `02.04`.

## Ownership and Review Responsibilities

| Domain | Canonical Source | Owner Team | Required Reviewers | Website Role |
| --- | --- | --- | --- | --- |
| Runtime control plane | `projectathena/docs/platform/runtime/*` | Athena Runtime | `@athena-runtime`, `@website-docs` | Import curated stable references |
| Security and identity | `projectathena/docs/platform/security/*` | Athena Security | `@athena-security`, `@website-docs` | Import public-safe contract summaries |
| Observability and auditability | `projectathena/docs/platform/observability/*` | Athena Platform | `@athena-platform`, `@website-docs` | Import event model and evidence references |
| API reference | `projectathena/docs/api/*` | Athena API | `@athena-api`, `@website-docs` | Import endpoint-level contracts for docs users |
| Website operations/editorial | `teamorchestrator.com/internal-docs/developer` and `src/content/docs` | Website Docs | `@website-docs` | Local source of truth (not imported) |

## Initial Curated Athena Mappings

Seed entries are defined in `internal-docs/architecture/projectathena-docs-ingestion-manifest.json` and are intentionally small to keep first sync scope reviewable.

Initial curated IDs:

1. `athena-runtime-control-plane-overview`
2. `athena-agent-orchestration-lifecycle`
3. `athena-identity-and-authn`
4. `athena-observability-and-audit-events`
5. `athena-api-mission-run-endpoint`

## Change Management Rules

1. Any change to `destinationSlug` for a `published` entry requires explicit migration approval and redirect/stub plan.
2. New entries must include owner and reviewer handles before merge.
3. Manifest and ownership map updates should land in the same pull request when domain responsibilities change.
