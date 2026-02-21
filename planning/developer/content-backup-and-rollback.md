<!-- AUDIENCE: Internal/Technical -->

# Content Backup and Rollback Runbook

Use this runbook when website content, metadata, or release-critical docs/config ship with regressions and must be restored quickly.

## Protected Content Surfaces

Always treat these paths as rollback-critical:

- `src/content/*` (docs/blog pages, frontmatter metadata, content collections)
- `planning/*` (operator docs, checklists, workflow guides consumed by delivery process)
- Release-critical docs/config in repo root (for example `README.md`, `GETTING_STARTED.md`, `package.json` scripts tied to content build/validation)

## Rollback Triggers

Start rollback preparation immediately when any trigger is true:

- Production page returns `404`/`500` for previously stable routes.
- Static smoke checks fail after content release (`npm run check:static` or `npm run validate:deploy`).
- Broken internal links are introduced in generated output.
- Frontmatter/metadata regression breaks build output, routing, or canonical tags.
- Operator confirms incorrect or stale content published to a critical route (`/`, `/docs/*`, `/blog/*`).

## Decision Points

Use this flow to choose between fix-forward and rollback:

1. Determine blast radius:
   - Single non-critical route and low user impact: prefer fix-forward.
   - Multiple routes, homepage/docs root impact, or broken navigation/indexing metadata: rollback.
2. Estimate recovery time:
   - If a safe fix cannot be prepared and validated within 30 minutes, rollback.
3. Verify availability of known-good commit/tag:
   - If known-good is available and smoke checks previously passed, rollback is preferred.

## Backup Expectations Before Content Release

Create a rollback anchor before merging or releasing content changes.

1. Ensure branch is clean and up to date:
   - `git status --short`
   - `git fetch origin`
2. Create a backup tag on current known-good commit:
   - `git tag content-backup-YYYYMMDD-HHMM <known-good-commit>`
   - `git push origin content-backup-YYYYMMDD-HHMM`
3. Record backup anchor in release notes or handoff:
   - commit SHA
   - tag name
   - brief scope summary (paths changed)

## Operator Rollback Steps

When rollback is approved, execute:

1. Identify rollback target:
   - `git log --oneline --decorate -n 20`
   - Choose latest known-good commit/tag before regression.
2. Create rollback branch from the current branch tip:
   - `git switch -c rollback/content-YYYYMMDD-HHMM`
3. Restore affected surfaces from known-good target:
   - `git restore --source <known-good-ref> -- src/content planning README.md GETTING_STARTED.md package.json`
4. Review what will be reverted:
   - `git status --short`
   - `git diff --stat`
5. Validate locally:
   - `npm run build`
   - `npm run validate:deploy`
6. Commit rollback:
   - `git commit -am "Rollback content regression to <known-good-ref>"`
7. Open and merge emergency PR using standard approval policy.

## Post-Rollback Verification

After merge/deploy, verify:

1. Static validation remains clean:
   - `npm run validate:deploy`
2. URL stability:
   - Core routes resolve: `/`, `/blog`, `/docs`
   - Previously affected routes return expected pages.
3. Metadata correctness:
   - Check canonical tags/title/description for affected pages.
4. Monitoring and manual checks:
   - Confirm no new broken-link or smoke-check failures.
5. Incident closure:
   - Record root cause, rollback ref, and fix-forward follow-up story in backlog.

## Guardrails

- Prefer `git restore --source ...` for targeted rollback; avoid destructive history rewriting.
- Roll back only affected surfaces when possible to minimize unrelated regression risk.
- Keep backup tags immutable once referenced in release/handoff artifacts.
