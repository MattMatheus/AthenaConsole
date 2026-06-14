# Plan 011: Fix task-list N+1 by adding `AgentIndexRepository.get`

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in "STOP
> conditions" occurs, stop and report — do not improvise. When done, update the
> status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182e9ba..HEAD -- packages/core/src/control-plane/app-state/repositories.ts packages/core/src/control-plane/services/task-workbench.ts`

## Why this matters

`GET /tasks` (polled by the console roughly every 30s) maps every task through
`mapTaskRecord` → `evaluateTaskRunReadiness` → `resolveAssignedAgentForReadiness`,
which calls `appState.agents.list().find(...)`. `AgentIndexRepository.list()`
selects **all** agents and `JSON.parse`s each agent's `capabilities_json` **and**
`manifest_json` on every call. So a task list of T tasks against A agents performs
T full agent-table scans with T×A manifest JSON parses per render. The repository
has no `get(id, version)` — unlike `PluginIndexRepository`, which does. Adding a
single-row lookup removes the per-task full scan.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive repository method; readiness output unchanged)
- **Depends on**: plans/010-consolidate-row-mappers.md (soft — reduces churn in `task-workbench.ts`; can proceed without it)
- **Category**: performance (N+1)
- **Planned at**: commit `182e9ba`, 2026-06-13

## Current state

The hot resolver, `packages/core/src/control-plane/services/task-workbench.ts:2508`:

```ts
function resolveAssignedAgentForReadiness(
  appState: AppStateDatabase,
  assignedAgentId: string,
  assignedAgentVersion: string | undefined
): { agent: AgentIndexRecord; plugin: PluginIndexRecord } | undefined {
  const agent = appState.agents
    .list()
    .find((candidate) => candidate.id === assignedAgentId && (!assignedAgentVersion || candidate.version === assignedAgentVersion));
  if (!agent) return undefined;
  const plugin = appState.plugins.get(agent.pluginId, agent.pluginVersion);
  if (!plugin || !plugin.enabled || plugin.status !== "loaded" || agent.status !== "loaded") return undefined;
  return { agent, plugin };
}
```

`AgentIndexRepository` (`app-state/repositories.ts:545`) has `list()` (parses every
row, `:600`/`:636`) and `listForPlugin()` but **no `get`/`findById`**. The exemplar
to mirror — `PluginIndexRepository.get` (`app-state/repositories.ts:458`):

```ts
get(id: string, version: string): PluginIndexRecord | undefined {
  const row = this.getStatement.get(id, version) as PluginIndexRow | undefined;
  return row ? this.mapRow(row) : undefined;
}
```

The readiness resolver must preserve current matching semantics: if
`assignedAgentVersion` is given, match exact id+version; if it is undefined, pick
the lowest version for that id (today `list()` is ordered `id asc, version asc`, so
`.find` returns the lowest-version match).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck core | `npm --workspace @athena/core run typecheck` | exit 0 |
| App-state tests | `npm --workspace @athena/core run test:unit -- app-state` | all pass |
| Workbench tests | `npm --workspace @athena/core run test:unit -- workbench` | all pass |
| All core tests | `npm --workspace @athena/core run test:unit` | all pass |

## Scope

**In scope**:
- `packages/core/src/control-plane/app-state/repositories.ts` (add `get` + `findById` to `AgentIndexRepository`)
- `packages/core/src/control-plane/services/task-workbench.ts` (use the new methods in `resolveAssignedAgentForReadiness`)
- `packages/core/tests/` app-state test file for the repository (find with `ls packages/core/tests | grep -i app-state`)

**Out of scope** (do NOT touch):
- Other `agents.list().find(...)` call sites in `task-workbench.ts` (e.g. near `:1085`, `:1113`, `:3240`) — those are not the per-list-row hot path; note them but do not change them here.
- The readiness computation logic itself.

## Git workflow

- Branch: `advisor/011-task-list-n-plus-one`
- Commit per logical unit (repo method; service usage); short imperative messages.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add prepared-statement lookups to `AgentIndexRepository`

In `app-state/repositories.ts`, in the `AgentIndexRepository` constructor, add two
prepared statements alongside `listStatement` (use the exact column list from the
existing `listStatement` SQL at `:553`):

```ts
this.getStatement = db.prepare(
  "select id, version, plugin_id, plugin_version, name, capabilities_json, manifest_json, status, lifecycle_status, created_at, updated_at from agent_index where id = ? and version = ?"
);
this.findByIdStatement = db.prepare(
  "select id, version, plugin_id, plugin_version, name, capabilities_json, manifest_json, status, lifecycle_status, created_at, updated_at from agent_index where id = ? order by version asc limit 1"
);
```

Declare the two fields (`private readonly getStatement: Database.Statement;` etc.)
and add the methods, reusing `this.mapRow`:

```ts
get(id: string, version: string): AgentIndexRecord | undefined {
  const row = this.getStatement.get(id, version) as AgentIndexRow | undefined;
  return row ? this.mapRow(row as AgentIndexRow) : undefined;
}

findById(id: string): AgentIndexRecord | undefined {
  const row = this.findByIdStatement.get(id) as AgentIndexRow | undefined;
  return row ? this.mapRow(row as AgentIndexRow) : undefined;
}
```

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 2: Use the lookups in the readiness resolver

Replace the `list().find(...)` in `resolveAssignedAgentForReadiness`:

```ts
const agent = assignedAgentVersion
  ? appState.agents.get(assignedAgentId, assignedAgentVersion)
  : appState.agents.findById(assignedAgentId);
if (!agent) return undefined;
```

This preserves semantics: exact match when a version is given; lowest version
otherwise (the `order by version asc limit 1` mirrors the old `.find` over the
`version asc` list).

**Verify**: `npm --workspace @athena/core run typecheck` → exit 0.

### Step 3: Run the suites

**Verify**: `npm --workspace @athena/core run test:unit -- app-state` and `-- workbench` → all pass; then the full `npm --workspace @athena/core run test:unit` → all pass.

## Test plan

- New repository tests in the app-state test file: insert two agents with the same
  `id` and different versions; assert `get(id, v)` returns the exact version,
  `get(id, "missing")` returns `undefined`, and `findById(id)` returns the lowest
  version. Model on the existing `PluginIndexRepository` tests in the same file.
- Existing readiness/workbench tests confirm the resolver output is unchanged.
- Verification: `npm --workspace @athena/core run test:unit` → all pass.

## Done criteria

ALL must hold:

- [ ] `AgentIndexRepository` has `get(id, version)` and `findById(id)` backed by prepared statements
- [ ] `resolveAssignedAgentForReadiness` no longer calls `agents.list()`
- [ ] `npm --workspace @athena/core run typecheck` exits 0
- [ ] `npm --workspace @athena/core run test:unit` exits 0; new repository tests pass
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The `agent_index` table schema differs from the column list in the existing `listStatement` (drift) — use the live schema.
- Removing `list()` from the readiness path changes any readiness test result (it should not) — report the failing case.

## Maintenance notes

- The remaining `agents.list().find(...)` sites in `task-workbench.ts` can be migrated to `get`/`findById` opportunistically; they are not on the per-list-row hot path so they were left out to keep this change small.
- Reviewer should confirm no behavior change in readiness output, only fewer queries/parses.
- If task lists grow large, also consider hoisting a single plugin lookup per list call; out of scope here.
