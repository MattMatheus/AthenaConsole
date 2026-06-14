# Plan 013: Code-split console routes

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- apps/console/src/app/routes.tsx apps/console/src/layout/AppLayout.tsx apps/console/vite.config.ts`

## Why this matters

The console statically imports all ~20 page modules in `routes.tsx`, so the initial
bundle includes every page plus heavyweight deps used by only one or two pages
(`prismjs`, `react-markdown`) — even when the app opens to the Dashboard. There is
no `React.lazy` anywhere. Route-level code-splitting means the dashboard's first
paint downloads only what it needs, and the large/rarely-hit pages (Workflows ~964
LOC, TaskCreate ~912 LOC, Sessions/RunHistory + prismjs + react-markdown) load on
demand.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (react-router v6 supports lazy elements; needs a Suspense fallback)
- **Depends on**: none
- **Category**: performance (bundle size)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

`apps/console/src/app/routes.tsx` statically imports every page as a NAMED export
and registers them in a `createBrowserRouter([...])` tree, e.g.:

```ts
import { DashboardPage } from "../pages/DashboardPage";
import { WorkflowsPage } from "../pages/WorkflowsPage";
...
export const router = createBrowserRouter([
  { path: "/", element: <AppLayout />, children: [
    { index: true, element: <DashboardPage /> },
    { path: "workflows", element: <WorkflowsPage /> },
    ...
  ]}
]);
```

`apps/console/src/layout/AppLayout.tsx` renders the routed page via `<Outlet />`
inside `<main className={styles.detailPane}>` (line 180):

```tsx
<main className={styles.detailPane}>
  <Outlet />
</main>
```

`apps/console/vite.config.ts` `build.rollupOptions.output.manualChunks` only splits
`react`/`react-dom`/`@tanstack/react-query` into a `vendor` chunk; nothing else is
split. Pages are NAMED exports (so `React.lazy` needs a `.then` to map to `default`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck console | `npm --workspace @athena/console run typecheck` | exit 0 |
| Build console | `npm --workspace @athena/console run build` | exit 0; emits multiple JS chunks |
| Console tests | `npm --workspace @athena/console run test` | all pass |
| Lint console | `npm --workspace @athena/console run lint` | exit 0 |

## Scope

**In scope**:
- `apps/console/src/app/routes.tsx` (convert page imports to `React.lazy`)
- `apps/console/src/layout/AppLayout.tsx` (wrap `<Outlet />` in `<Suspense>`)

**Out of scope** (do NOT touch):
- Page component implementations.
- `vite.config.ts` `manualChunks` — once pages are lazy, Vite splits them automatically; do not hand-tune chunks.
- The navigation model / routing paths.

## Git workflow

- Branch: `advisor/013-console-code-splitting`
- One or two commits; short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Convert page imports to lazy in `routes.tsx`

Keep `DashboardPage` (the index route) eager for instant first paint. Convert the
rest to `React.lazy`, mapping the named export to `default`. Example:

```ts
import { lazy } from "react";
import { DashboardPage } from "../pages/DashboardPage"; // keep eager (index)

const WorkflowsPage = lazy(() =>
  import("../pages/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage }))
);
const TaskCreatePage = lazy(() =>
  import("../pages/TaskCreatePage").then((m) => ({ default: m.TaskCreatePage }))
);
// ...repeat for every other page, using each module's actual named export
```

Note the existing aliasing: `SessionsPage` is imported as `RunHistoryPage`
(`import { RunHistoryPage } from "../pages/SessionsPage"`). Preserve that — the lazy
version maps `m.RunHistoryPage`. Leave `Navigate`, route paths, and the tree shape
unchanged; only the element components become lazy.

**Verify**: `npm --workspace @athena/console run typecheck` → exit 0.

### Step 2: Add a Suspense boundary around the Outlet

In `AppLayout.tsx`, import `Suspense` from `react` and wrap the `<Outlet />`:

```tsx
import { Suspense, useEffect, useMemo, useState } from "react";
...
<main className={styles.detailPane}>
  <Suspense fallback={<div className={styles.detailPane} aria-busy="true">Loading…</div>}>
    <Outlet />
  </Suspense>
</main>
```

(Use a minimal fallback consistent with the app's style; a plain text node is
acceptable if no spinner component exists.)

**Verify**: `npm --workspace @athena/console run typecheck` → exit 0.

### Step 3: Build and confirm chunks split

```
npm --workspace @athena/console run build
```

**Verify**: the build succeeds and the output emits **multiple** page chunks (not
one monolithic app chunk). Inspect the build output file list — you should see
separate hashed chunks for the lazy pages, and `prismjs`/`react-markdown` should no
longer be in the entry/vendor chunk but in the chunks for the pages that use them.
Note the before/after entry-chunk size in your report if available.

### Step 4: Run tests and lint

**Verify**: `npm --workspace @athena/console run test` → all pass; `npm --workspace @athena/console run lint` → exit 0.

## Test plan

- No new unit tests required — this is a loading-strategy change. If a routing test
  renders a page directly and now needs a `Suspense` wrapper, add the wrapper in the
  test and note it.
- Verification: build emits split chunks; `npm --workspace @athena/console run test` passes.

## Done criteria

ALL must hold:

- [ ] All non-index pages in `routes.tsx` use `React.lazy`
- [ ] `<Outlet />` is wrapped in `<Suspense>` in `AppLayout.tsx`
- [ ] `npm --workspace @athena/console run typecheck` exits 0
- [ ] `npm --workspace @athena/console run build` exits 0 and emits multiple page chunks
- [ ] `npm --workspace @athena/console run test` exits 0
- [ ] `npm --workspace @athena/console run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- A page's actual export name differs from what `routes.tsx` currently imports (use the real name).
- The build fails to split (e.g. a barrel import re-introduces a static dependency) — report the offending import.
- A test relies on synchronous page rendering and cannot be made to await Suspense — report it.

## Maintenance notes

- New pages should be added as `React.lazy` imports by default.
- Reviewer should confirm the Dashboard (index) remains eager and the fallback does not cause layout shift.
- If a shared spinner component is later added, swap the text fallback for it.
