# Plan 036: Refresh vulnerable runtime dependency lockfile entries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 54f2135..HEAD -- package.json package-lock.json packages/core/package.json packages/core/package-lock.json apps/console/package.json apps/console/package-lock.json`
>
> If any in-scope dependency file changed since this plan was written, rerun the
> audit commands in step 1 before proceeding and adjust the package list to the
> live advisories.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED
- **Depends on**: none
- **Category**: security/migration
- **Planned at**: commit `54f2135`, 2026-06-16

## Why this matters

`npm audit --omit=dev --audit-level=high` reports high vulnerabilities in
runtime transitive dependencies used through `@kubernetes/client-node`. The
installed versions are older than the safe versions allowed by current semver
ranges, so this should be a lockfile/direct-minor refresh rather than a framework
upgrade. Leaving high advisories in production dependencies makes trusted-server
profiles harder to justify and obscures future dependency risk.

## Current state

Relevant files:

- `package.json` and `package-lock.json` are the root workspace dependency files.
- `packages/core/package.json` contains runtime dependencies that pull the high
  advisories.
- `apps/console/package.json` contains `react-router-dom`, which has a moderate
  advisory in the current audit.
- If package-lock files exist under workspaces, update them only if the package
  manager touches them as part of a normal install/update.

Current direct dependencies:

```json
// packages/core/package.json:51-58
"dependencies": {
  "@azure/identity": "^4.6.0",
  "@kubernetes/client-node": "^1.4.0",
  "ajv": "^8.17.1",
  "better-sqlite3": "^12.10.0",
  "ioredis": "^5.4.1",
  "js-yaml": "^4.1.1"
}

// apps/console/package.json:15-23
"dependencies": {
  "@athena/core": "*",
  "@tanstack/react-query": "^5.80.10",
  "lucide-react": "^0.525.0",
  "prismjs": "^1.30.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-markdown": "^10.1.0",
  "react-router-dom": "^6.30.1"
}
```

Current high advisory path:

```text
$ npm ls form-data ws --all
team-orchestrator-workspace@
└─┬ @athena/core@0.1.0 -> ./packages/core
  └─┬ @kubernetes/client-node@1.4.0
    ├─┬ @types/node-fetch@2.6.13
    │ └── form-data@4.0.5 deduped
    ├── form-data@4.0.5
    ├─┬ isomorphic-ws@5.0.0
    │ └── ws@8.19.0 deduped
    └── ws@8.19.0
```

Audit findings from the planning run:

- High: `form-data <4.0.6`, installed as `4.0.5` via
  `@kubernetes/client-node`.
- High: `ws <8.21.0`, installed as `8.19.0` via `@kubernetes/client-node`.
- Moderate: `@azure/identity` through `@azure/msal-node`/`uuid`.
- Moderate: `js-yaml <=4.1.1`.
- Moderate: `react-router-dom`/`react-router <6.30.4`.
- Moderate: `ip-address`.

`@kubernetes/client-node@1.4.0` was the latest version at planning time and its
dependency ranges allow safe transitive versions for `form-data` and `ws`, so
try a narrow lock refresh before using overrides.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Audit current runtime deps | `npm audit --omit=dev --audit-level=high --json` | JSON output; after remediation, exit 0 |
| Inspect vulnerable tree | `npm ls form-data ws react-router-dom react-router js-yaml @azure/identity ip-address --all` | exits 0 or shows only dependency tree problems relevant to this plan |
| Core typecheck | `npm --workspace @athena/core run typecheck` | exit 0 |
| Console typecheck | `npm --workspace @athena/console run typecheck` | exit 0 |
| API/PDK typechecks | `npm --workspace @athena/api run typecheck && npm --workspace @athena/pdk run typecheck` | exit 0 |
| Core tests | `npm --workspace @athena/core run test:unit` | exit 0 |
| Console tests | `npm --workspace @athena/console run test` | exit 0 |
| PDK tests | `npm --workspace @athena/pdk test` | exit 0 |
| Lint | `npm run lint` | exit 0; existing warnings are acceptable if unchanged |
| Manifests/schema | `npm --workspace @athena/core run validate:manifests && npm --workspace @athena/core run check:schemas` | exit 0 |
| Whitespace guard | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `package.json`
- `package-lock.json`
- `packages/core/package.json`
- `packages/core/package-lock.json` if present and updated by npm
- `apps/console/package.json`
- `apps/console/package-lock.json` if present and updated by npm

**Out of scope**:

- Do not run `npm audit fix --force`.
- Do not perform major framework upgrades.
- Do not remove Kubernetes, Azure, router, or YAML functionality.
- Do not change production source code to work around dependency updates unless
  a narrow compatibility fix is required and approved by the operator.

## Git workflow

- Branch: `advisor/036-refresh-vulnerable-runtime-dependencies`
- Commit when the plan is complete and verified. An acceptable message is
  `Refresh vulnerable runtime dependencies`.
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Reproduce the live audit

Run:

```sh
npm audit --omit=dev --audit-level=high --json
npm ls form-data ws react-router-dom react-router js-yaml @azure/identity ip-address --all
npm view @kubernetes/client-node version dependencies --json
```

Record the high advisories and installed versions in your handoff. If the audit
is already clean at `--audit-level=high`, stop and report that the plan is stale
unless moderate advisories are still explicitly requested by the operator.

**Verify**: commands complete and confirm whether `form-data` and `ws` are still
the high advisory paths.

### Step 2: Try the narrow lockfile refresh first

Use npm, matching the existing lockfile. Try a narrow update that keeps current
semver ranges:

```sh
npm update form-data ws js-yaml react-router react-router-dom @azure/identity ip-address --workspaces --save=false
```

If npm rejects `--workspaces --save=false` for this repo layout, run the narrow
equivalent from the root without changing package manager:

```sh
npm update form-data ws js-yaml react-router react-router-dom @azure/identity ip-address --save=false
```

Then inspect the diff. Expected minimal result:

- `package-lock.json` updates `form-data` to at least `4.0.6`.
- `package-lock.json` updates `ws` to at least `8.21.0`.
- `package-lock.json` updates `js-yaml` to a non-vulnerable release if npm can.
- `package-lock.json` updates `react-router`/`react-router-dom` to at least
  `6.30.4` if npm can.
- `package-lock.json` updates `@azure/identity` and `ip-address` if npm can.
- Direct package manifests may remain unchanged if current ranges allow the safe
  versions.

**Verify**:

```sh
npm ls form-data ws react-router-dom react-router js-yaml @azure/identity ip-address --all
```

Expected: vulnerable packages resolve to safe versions where semver ranges allow.

### Step 3: Raise direct minimums if needed

If the narrow lock refresh leaves direct dependencies on vulnerable versions,
update the direct manifests:

- In `packages/core/package.json`, raise:
  - `@azure/identity` to a safe `^4.x` version reported by `npm audit fix --dry-run`
    or `npm view @azure/identity version`
  - `js-yaml` to a safe `^4.x` version, expected at least `^4.2.0`
- In `apps/console/package.json`, raise:
  - `react-router-dom` to at least `^6.30.4`

Then run `npm install` at the repo root to refresh the lockfile.

Do not raise React, TypeScript, Vite, Vitest, or `@kubernetes/client-node` unless
the live audit proves that a direct safe minor is available and required.

**Verify**:

```sh
npm ls form-data ws react-router-dom react-router js-yaml @azure/identity ip-address --all
```

Expected: direct dependencies resolve to safe versions.

### Step 4: Add root overrides only if semver refresh cannot resolve transitive highs

If `form-data` or `ws` remains vulnerable only because a transitive dependency is
stuck in the lockfile, add the smallest root `overrides` block in `package.json`.

Preferred minimal overrides:

```json
"overrides": {
  "form-data": "^4.0.6",
  "ws": "^8.21.0"
}
```

Add `js-yaml` or `ip-address` overrides only if the audit still flags them and
the owning dependency range allows the safe version. Do not use overrides to
force an incompatible major.

Run `npm install` after adding overrides.

**Verify**:

```sh
npm ls form-data ws react-router-dom react-router js-yaml @azure/identity ip-address --all
npm audit --omit=dev --audit-level=high
```

Expected: `npm audit --omit=dev --audit-level=high` exits 0.

### Step 5: Validate runtime compatibility

Run the full validation set:

```sh
npm --workspace @athena/core run typecheck
npm --workspace @athena/console run typecheck
npm --workspace @athena/api run typecheck
npm --workspace @athena/pdk run typecheck
npm --workspace @athena/core run test:unit
npm --workspace @athena/console run test
npm --workspace @athena/pdk test
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run check:schemas
npm run lint
git diff --check
```

Expected: every command exits 0. Existing lint warnings are acceptable if the
exit code is 0 and the warning count/type does not materially change.

## Test plan

No new tests should be required for a lockfile/direct-minor dependency refresh.
The compatibility signal is the existing typecheck, unit, manifest, schema, and
lint suite. If a dependency update causes a source compatibility error, stop
unless the fix is a narrow import/type adjustment inside a package directly
using the dependency and the operator approves touching source code.

## Done criteria

All must hold:

- [ ] `npm audit --omit=dev --audit-level=high` exits 0.
- [ ] `npm ls form-data ws --all` shows `form-data >= 4.0.6` and `ws >= 8.21.0`.
- [ ] Direct vulnerable dependencies are raised only within compatible minor or
      patch ranges.
- [ ] No `npm audit fix --force` changes or major framework upgrades were used.
- [ ] `npm --workspace @athena/core run typecheck` exits 0.
- [ ] `npm --workspace @athena/console run typecheck` exits 0.
- [ ] `npm --workspace @athena/api run typecheck` exits 0.
- [ ] `npm --workspace @athena/pdk run typecheck` exits 0.
- [ ] `npm --workspace @athena/core run test:unit` exits 0.
- [ ] `npm --workspace @athena/console run test` exits 0.
- [ ] `npm --workspace @athena/pdk test` exits 0.
- [ ] `npm --workspace @athena/core run validate:manifests` exits 0.
- [ ] `npm --workspace @athena/core run check:schemas` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `plans/README.md` status row for plan 036 is updated.

## STOP conditions

Stop and report if:

- The live audit identifies different high advisories than this plan and they
  require a different remediation path.
- `@kubernetes/client-node` or another runtime dependency pins a vulnerable
  package to an incompatible range that cannot be fixed by patch/minor refresh or
  a safe override.
- npm attempts to remove workspace packages, rewrite package manager metadata
  unexpectedly, or perform major framework upgrades.
- A dependency update requires non-trivial production source changes.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Reviewers should focus on lockfile minimality. A clean fix should mostly update
vulnerable package versions and direct minimums, not churn unrelated dependency
trees. Keep `npm audit --omit=dev --audit-level=high` in release checks for
trusted-server profiles so high runtime advisories do not regress.
