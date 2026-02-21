# ProjectAthena Docs Sync

Story: `02.04-implement-projectathena-docs-sync-script-and-guardrails`

## Purpose

Generate website docs from curated `projectathena/docs` mappings defined in the ingestion manifest.

## Inputs

- Manifest: `internal-docs/architecture/projectathena-docs-ingestion-manifest.json`
- Manifest schema: `internal-docs/architecture/projectathena-docs-ingestion-manifest.schema.json`
- Source root: local checkout path to `projectathena/docs`

## Command

```bash
npm run sync:projectathena-docs -- \
  --source-commit "$(git -C ~/Source/projectathena rev-parse --short HEAD)" \
  --synced-at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

Optional flags:

- `--source-root <path>` (default: `~/Source/projectathena/docs`; override via `PROJECTATHENA_DOCS_ROOT`)
- `--manifest <path>`
- `--dest-root <path>`

## Guardrails

1. Fails fast on missing source files listed in manifest.
2. Fails fast on duplicate `destinationSlug` values.
3. Fails if `slugLocked` is not `true` for any entry.
4. Fails if owner metadata (`owner.team`, `owner.reviewers`) is missing.
5. Refuses to overwrite destination files that do not include generated-file header markers.

## Generated Output

- Writes managed files under `src/content/docs/reference/*.md` based on manifest `destinationSlug`.
- Generated frontmatter includes:
  - `sourcePath`
  - `sourceCommit`
  - `lastSyncedAt`
  - `generatedBy`
  - `generatedFromManifestId`
- Generated files include `DO NOT EDIT` and source content hash markers.

## Determinism Notes

- Output ordering is deterministic (sorted by `destinationSlug`).
- Provide stable values for `--source-commit` and `--synced-at` to ensure repeatable output.
- Script does not embed runtime clock timestamps by default.
