# Plan 002: Bound LSP file paths to the workspace root

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/services/lsp.ts packages/core/src/control-plane/services/repositories.ts`
> If `lsp.ts` changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (path traversal / arbitrary file read)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Why this matters

The LSP service resolves a caller-supplied `file` into an absolute path and reads
it from disk, but it performs **no containment check** — an absolute path or a
`../`-laden relative path escapes the workspace and the file's contents are
returned in LSP hover/definition/symbol responses. These operations are gated at
the lowest role (Viewer). For local single-user use the impact is small, but in
any authenticated/multi-user deployment a Viewer can read arbitrary host files
(configs, keys, other tenants' data). The repository already proves it knows the
safe pattern: `repositories.ts` enforces exactly this containment for managed
clones. This makes the fix a consistency fix, not a new design.

## Current state

File: `packages/core/src/control-plane/services/lsp.ts`

The vulnerable resolver (no containment check):

```ts
// lsp.ts:462
function normalizeAbsolutePath(workspaceRoot: string, file: string): string {
  const trimmed = file.trim();
  if (!trimmed) {
    throw new AthenaError("CONFIG_ERROR", "file is required.");
  }
  return isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
}
```

It is called on every LSP operation, and the result is read from disk:

```ts
// lsp.ts:111 (getDocumentSymbols) and lsp.ts:157 (execute, used by definition/references/hover)
const absoluteFile = normalizeAbsolutePath(this.config.workspaceRoot, file);
const uri = pathToFileURL(absoluteFile).href;
...
// lsp.ts:255 (syncDocument)
async syncDocument(uri: string, language: LspLanguage, absoluteFile: string): Promise<void> {
  const text = await readFile(absoluteFile, "utf8");   // <-- arbitrary file read sink
```

The operations (`lsp.definition`, `lsp.references`, `lsp.hover`, `lsp.symbols`)
are authorized at Viewer level — see `services/authorization.ts:1058-1086`.

**The exemplar to mirror** — `packages/core/src/control-plane/services/repositories.ts:304`:

```ts
function resolveManagedClonePath(config: AthenaConfig, id: string, name: string): string {
  const root = resolve(config.workspaceRoot, "repos", "managed");
  const slug = slugify(id || name);
  const destination = resolve(root, slug);
  const rootWithSeparator = root.endsWith("/") ? root : `${root}/`;
  if (destination !== root && !destination.startsWith(rootWithSeparator)) {
    throw new AthenaError("CONFIG_ERROR", "Managed repository destination escaped the managed repo root.");
  }
  return destination;
}
```

`normalizeAbsolutePath` already imports `isAbsolute` and `resolve` from `node:path` (used at line 467). Confirm `sep` is importable from `node:path` in this file (add it to the existing import if absent).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| LSP tests | `npm --workspace @athena/core run test:unit -- control-plane.lsp` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/services/lsp.ts` (add containment check in `normalizeAbsolutePath`)
- `packages/core/tests/control-plane.lsp.test.ts` (add traversal-rejection tests)

**Out of scope** (do NOT touch):
- The authorization role mapping in `services/authorization.ts` — the fix is path containment, not a role change.
- `repositories.ts` — it is the exemplar; leave it as-is.
- The LSP client/process management code (`ManagedLspClient`).

## Git workflow

- Branch: `advisor/002-bound-lsp-file-paths`
- One commit; message e.g. `fix(lsp): reject file paths outside the workspace root`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a containment check to `normalizeAbsolutePath`

Rewrite `normalizeAbsolutePath` (lsp.ts:462) so the resolved path must stay within `workspaceRoot`, mirroring `resolveManagedClonePath`:

```ts
function normalizeAbsolutePath(workspaceRoot: string, file: string): string {
  const trimmed = file.trim();
  if (!trimmed) {
    throw new AthenaError("CONFIG_ERROR", "file is required.");
  }
  const root = resolve(workspaceRoot);
  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolute !== root && !absolute.startsWith(rootWithSeparator)) {
    throw new AthenaError("CONFIG_ERROR", "file must resolve inside the workspace root.");
  }
  return absolute;
}
```

Notes:
- Use `sep` from `node:path` (add to the existing `node:path` import at the top of the file if not already imported).
- `resolve(trimmed)` normalizes `..` segments in absolute inputs too, so `/workspace/../etc/passwd` is caught.

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Add rejection tests

In `packages/core/tests/control-plane.lsp.test.ts`, add tests asserting that traversal and absolute-escape inputs are rejected with a `CONFIG_ERROR`. Use the existing tests in that file as the structural pattern (same service construction, same `AthenaError` assertion style). Cover at minimum:
- a relative `../`-escaping path (e.g. `"../../etc/hosts"`)
- an absolute path outside the workspace (e.g. `"/etc/hosts"`)
- a valid in-workspace relative path still resolves (happy path — pick an extension the service supports, e.g. `"src/index.ts"`, and assert it does NOT throw `CONFIG_ERROR` for the path check; it may still fail later for unrelated reasons like no language server, which is fine — assert specifically that the rejection message is not raised).

**Verify**: `npm --workspace @athena/core run test:unit -- control-plane.lsp` → all pass, including the new cases.

## Test plan

- New tests in `packages/core/tests/control-plane.lsp.test.ts`, modeled on the existing cases in the same file.
- Cases: `../` traversal rejected; absolute out-of-root rejected; in-root path accepted by the containment check.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `normalizeAbsolutePath` throws `CONFIG_ERROR` for any path that resolves outside `workspaceRoot`
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; new traversal-rejection tests exist and pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `normalizeAbsolutePath` at lsp.ts no longer matches the excerpt (drift).
- The LSP service is intended to operate on files outside the workspace by design (search `docs/` for any statement to that effect) — if you find such a documented decision, report it instead of changing behavior.
- Adding the check breaks an existing LSP test that relied on out-of-root paths — report which test and its intent before changing it.

## Maintenance notes

- If the LSP service ever legitimately needs multiple roots, extend the check to an allowlist of roots rather than removing it.
- Reviewer should confirm both call sites (lsp.ts:111 and lsp.ts:157) flow through `normalizeAbsolutePath` and that no other code constructs `absoluteFile` for `syncDocument` directly.
- This same containment pattern (`resolve` + `startsWith(root + sep)`) is the repo standard; reuse it for any future filesystem-path-from-input code.
