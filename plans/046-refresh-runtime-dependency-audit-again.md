# Plan 046: Refresh runtime dependencies until production audit passes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- package.json package-lock.json apps/console/package.json packages/core/package.json packages/pdk/package.json apps/api/package.json plans/README.md`
>
> If any in-scope file changed since this plan was written, run
> `npm audit --omit=dev --json` first and compare the output to the "Current
> state" section. If production audit is already clean, stop and report that this
> plan is stale.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: MED
- **Depends on**: none; coordinate with any branch touching `package-lock.json`
- **Category**: security/migration
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

Plan 036 is marked done, but the current root production audit still fails with
two high and seven moderate advisories. This means the remediation either
regressed, did not land in the current working tree, or did not update every
runtime path. CI and release confidence need `npm audit --omit=dev` to be clean
or to have a documented, accepted exception.

## Current state

Relevant files:

- `package.json` and `package-lock.json` define the root npm workspace dependency
  graph used by CI.
- `apps/console/package.json` declares `react-router-dom`.
- `packages/core/package.json` declares `@azure/identity` and `js-yaml`.
- `plans/README.md` marks prior dependency plan 036 as done.

Prior plan is marked complete:

```md
// plans/README.md:72-74
| 034 | Add authorization wrappers for remaining API families | P1 | M | none | security | DONE ✓ reviewed 2026-06-16 (`7818911`) |
| 035 | Derive workspace scope from server-side membership | P1 | L | none; recommended after 034 | security | DONE ✓ reviewed 2026-06-16 (`378774f`) |
| 036 | Refresh vulnerable runtime dependency lockfile entries | P1 | S-M | none | security/migration | DONE ✓ reviewed 2026-06-16 (`edb20c8`) |
```

Current `npm audit --omit=dev --json` exits 1 with this summary:

```json
{
  "metadata": {
    "vulnerabilities": {
      "moderate": 7,
      "high": 2,
      "total": 9
    }
  }
}
```

Current vulnerable runtime entries include:

```json
// package-lock.json:167-170
"node_modules/@azure/identity": {
  "version": "4.13.0"
}

// package-lock.json:4040-4043
"node_modules/form-data": {
  "version": "4.0.5"
}

// package-lock.json:6460-6463
"node_modules/react-router-dom": {
  "version": "6.30.3"
}

// package-lock.json:8602-8605
"node_modules/ws": {
  "version": "8.19.0"
}
```

The audit output also reports direct or transitive advisories involving
`@azure/msal-node`, `ip-address`, `js-yaml`, `react-router`, and `uuid`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Baseline audit | `npm audit --omit=dev --json` | currently exits 1; use to confirm live advisories |
| Install/update lock | `npm install` | exits 0 and updates root lock consistently |
| Production audit | `npm audit --omit=dev` | exits 0 |
| Root typecheck | `npm run typecheck` | exits 0 |
| Root tests | `npm run test` | exits 0 |
| Console build | `npm --workspace @athena/console run build` | exits 0 |
| Diff guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- Root `package.json`
- Root `package-lock.json`
- Workspace package manifests only when direct dependency ranges must move:
  - `packages/core/package.json`
  - `apps/console/package.json`
  - `apps/api/package.json`
  - `packages/pdk/package.json`

**Out of scope**:

- Do not reintroduce nested workspace `package-lock.json` files.
- Do not change package manager.
- Do not use `--force` or accept semver-major upgrades without reading release
  notes and running targeted tests.
- Do not suppress audit output without a written exception in this plan and
  `plans/README.md`.

## Git workflow

- Branch: `advisor/046-refresh-runtime-dependency-audit-again`
- Commit message: `Refresh runtime dependencies for clean audit`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Capture the live audit

Run the production audit and save the dependency names/ranges that still fail.
Do not paste exploit details into code comments or docs; dependency names,
versions, severity, and fixed range are enough.

**Verify**:

- `npm audit --omit=dev --json` either exits 1 with advisories matching this
  plan, or exits 0. If it exits 0, stop and report that the plan is stale.

### Step 2: Update direct dependency ranges first

Update direct runtime dependencies to versions that satisfy the audit:

- `@azure/identity` in `packages/core/package.json`;
- `js-yaml` in `packages/core/package.json`;
- `react-router-dom` in `apps/console/package.json`.

Use normal `npm install` so the root lockfile updates. Avoid `npm audit fix
--force`.

**Verify**:

- `npm install` exits 0.
- `npm ls @azure/identity js-yaml react-router-dom react-router form-data ws uuid ip-address --omit=dev` exits 0 or only reports packages not present.

### Step 3: Resolve remaining transitive advisories

If `form-data`, `ws`, `uuid`, `ip-address`, or `@azure/msal-node` remain
vulnerable after direct dependency updates, identify their parent packages with
`npm ls <name> --omit=dev`.

Prefer upgrading the parent dependency over using overrides. Use a root
`overrides` block only when:

- the fixed version is semver-compatible with the parent range or verified by
  tests;
- no direct parent update is available;
- the override is documented with a one-line reason in `package.json`.

**Verify**:

- `npm audit --omit=dev` exits 0.

### Step 4: Run compatibility checks

Run the workspace checks most likely affected by dependency updates.

**Verify**:

- `npm run typecheck` exits 0.
- `npm run test` exits 0.
- `npm --workspace @athena/console run build` exits 0.
- `git diff --check` exits 0.

## Test plan

No new unit tests are required unless an upgraded dependency changes runtime
behavior. The verification suite is production audit, root typecheck, root tests,
and console build.

## Done criteria

- [ ] `npm audit --omit=dev` exits 0.
- [ ] Root lockfile is updated without nested package lockfiles.
- [ ] Runtime dependency changes are minimal and explainable.
- [ ] Root typecheck, root tests, console build, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The only audit fix requires a semver-major upgrade with breaking changes.
- A transitive advisory has no fixed version available.
- `npm audit --omit=dev` remains non-zero after reasonable dependency updates.
- Updating dependencies conflicts with another active branch modifying
  `package-lock.json`.

## Maintenance notes

Dependency audits should be run from the root workspace only. If an advisory is
accepted rather than fixed, record the exact dependency, reason, expiry date, and
owner in `plans/README.md`; do not leave a silent failing audit.
