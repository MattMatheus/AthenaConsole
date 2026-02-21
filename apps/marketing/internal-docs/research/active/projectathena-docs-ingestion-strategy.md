# ProjectAthena Docs Ingestion Strategy

Date: 2026-02-19
Story: `02.01-wire-projectathena-reference-docs-ingestion-strategy`

## Objective

Define how documentation from `projectathena/docs` should be surfaced in TeamOrchestrator.com while preserving stable URLs, clear ownership, and low drift risk.

## Source-of-Truth Ownership by Domain

| Domain | Canonical Source | Website Behavior |
| --- | --- | --- |
| Product runtime/control-plane internals | `projectathena/docs` | Mirror curated pages into website docs reference section |
| Website operations/editorial workflow | `teamorchestrator.com/internal-docs/developer` and `src/content/docs` | Authored and maintained locally |
| Marketing/product narrative | `teamorchestrator.com/src/content/*` | Authored and maintained locally |
| Cross-repo architecture references | `projectathena` primary, website summary secondary | Website links to canonical source and imports stable summaries only |

Ownership rule:
- If a page is operationally tied to Athena runtime contracts, Athena repo is canonical.
- If a page is about website publishing, lifecycle, or public content UX, website repo is canonical.

## Sync Option Trade-Offs

### Option A: Manual import

How it works:
- Contributor copies selected docs manually from `projectathena/docs` into `teamorchestrator.com/src/content/docs/reference/`.

Pros:
- Lowest tooling complexity.
- Easy to start immediately.

Cons:
- Highest drift risk.
- Hard to audit freshness.
- High reviewer burden.

### Option B: Scripted copy with manifest (recommended)

How it works:
- Maintain an ingestion manifest mapping Athena source files to website destination slugs.
- Run a script that copies/normalizes frontmatter and writes generated target files.

Pros:
- Drift risk is controlled and visible.
- Repeatable updates with deterministic output.
- Supports stable URL policy through explicit slug mapping.

Cons:
- Requires initial scripting and validation work.
- Needs policy for conflict handling when files move upstream.

### Option C: Generated references only (link-out)

How it works:
- Keep minimal website summaries and deep-link to Athena repo docs without local copies.

Pros:
- Zero duplication of full content.
- Lowest sync maintenance.

Cons:
- Weaker on-site docs experience.
- External link dependency for core reference flows.
- Inconsistent search/index coverage on website.

## Recommended Default

Adopt **Option B (scripted copy with manifest)**, plus selective link-out for low-priority reference pages.

Default policy:
1. Curate only public-facing, stable Athena docs into website reference docs.
2. Use an explicit manifest as the contract for source path -> destination slug mapping.
3. Keep imported pages clearly marked as synced from Athena with source and sync timestamp metadata.
4. Preserve website routes once published; if source path changes, update manifest mapping rather than URL slug.

## Versioning and Archive Behavior

1. Each sync run records source commit SHA for traceability.
2. If a source doc is removed upstream:
   - Keep existing website page for one deprecation cycle.
   - Add a top notice marking deprecation and replacement link (if available).
3. If a source doc is split/renamed upstream:
   - Maintain old website route with redirect or retained stub page.
   - Update manifest to new source target(s) without breaking existing URLs.
4. Archive policy:
   - Move retired imported docs into an archive section only when replacement is published.

## Risk Controls for Stale or Conflicting Docs

- **Freshness control:** include `sourceCommit` and `lastSyncedAt` fields in generated frontmatter.
- **Conflict control:** block manual edits to generated docs via header notice and regeneration rule.
- **Route safety:** maintain slug lock in manifest once route is public.
- **Review gate:** require diff review between upstream source and generated output before publish.
- **Fallback path:** if sync fails, keep last known good generated docs rather than removing pages.

## Follow-Up Implementation Tasks (Added To Backlog)

1. `02.03-establish-docs-ingestion-manifest-and-ownership-map.md`
2. `02.04-implement-projectathena-docs-sync-script-and-guardrails.md`

## Decision Summary

- Recommendation: **Scripted copy with manifest**.
- Reason: best balance of stability, quality control, and maintainability for Stage 8 reliability expectations.
