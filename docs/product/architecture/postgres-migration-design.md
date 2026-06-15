# Postgres Migration Design

Goal: move SQLite-backed app state toward repository interfaces that can support Postgres without changing service contracts.

## Repository Mapping

| Area | Current Owner | Postgres Interface Direction |
| --- | --- | --- |
| Runs/tasks/missions | SQLite app-state domain repositories | Transactional repositories with explicit unit-of-work boundaries. |
| Model providers | SQLite metadata plus external secret refs | Same metadata table; secrets stay outside app-state. |
| Repositories | SQLite metadata plus filesystem working trees | Metadata in Postgres; working tree storage remains filesystem/object storage. |
| Workflow state | SQLite workflow state repository | Step/run tables with idempotent updates and attempt records. |
| Events/audit | Event store tables | Append-only event table with indexed type, subject, resource, run id, and timestamp. |
| Durable memory | Separate durable-memory storage | Keep separate provider interface; do not merge memory bodies into app-state. |

## Migration Order

1. Freeze domain repository interfaces and remove direct SQLite assumptions from services.
2. Add contract tests for each repository against SQLite.
3. Introduce Postgres implementations behind the same interfaces.
4. Add one-shot export/import from SQLite to Postgres for app-state metadata.
5. Run dual smoke on clean server: users/roles, providers, runs, artifacts, memory, audit.

## Blocking SQLite Assumptions

- Some services open app-state directly instead of receiving repositories.
- Cursor pagination is offset-oriented in places and should become keyset-ready.
- JSON columns are treated as opaque blobs; Postgres should index high-value fields only after the query model is stable.
- Local filesystem artifact paths must remain references, not Postgres payloads.

## Contract Test Coverage And Step-1 Findings

`packages/core/tests/control-plane.app-state-contract.test.ts` now covers the first backend-agnostic app-state repository contract slice. These tests use `openAppStateDatabase(loadConfig(tempDir))` only as the SQLite adapter factory and then exercise repositories through public methods. They do not read `appState.db` or assert SQLite internals.

| Repository | Covered by contract test | Interface-clean | Note |
| --- | --- | --- | --- |
| `tasks` | Yes | Yes | Public `create`, `get`, `list`, and `update` methods cover observable task persistence, bounded list behavior, workspace filtering, and ready-state assignment constraints. |
| `runs` | Yes | Yes | Public `create`, `get`, `list`, and `update` methods cover run creation, target filtering, and status/output transition behavior. |
| `missions` | Yes | Mostly | Public methods cover create/get/list/update, but current mission records do not expose `workspaceId` even though migration 20 added `missions.workspace_id`; workspace-aware Postgres behavior will need a follow-up contract once ADR 0028 is implemented. |
| `schedules` | Yes | Mostly | Public methods cover create/upsert/get/list-by-due-window. Current schedule records do not expose `workspaceId` even though migration 20 added `schedules.workspace_id`; workspace-aware Postgres behavior will need a follow-up contract once ADR 0028 is implemented. |
| `usageLedger` | Yes | Yes | Public methods cover unique-by-`runId` upsert behavior, `getByRunId`, and reporting-window filtering. |
| `workspaces` | Yes | Partial | Public methods expose the seeded `default` workspace through `get` and `list`; lifecycle is intentionally absent until ADR 0028 is accepted and implemented. |
| `connectedRepositories` | No | Mostly | Existing workspace tests cover public create/list/update behavior; the contract suite should add it when repository coverage expands beyond the initial six required repositories. |
| `modelProviderConfigs` | No | Mostly | Existing workspace tests cover public create/list/update behavior; the contract suite should add it when repository coverage expands. |
| `connectorCredentialBindings` | No | Mostly | Existing workspace tests cover public upsert/list behavior; the contract suite should add it when repository coverage expands. |
| `workflowDagRuns` | No | Unknown | Needs a dedicated contract because workflow DAG transitions are stateful and should be adapter-neutral before Postgres implementation. |
| `runEvents` / `artifacts` | No | Mostly | Existing workspace tests cover append/create and list-for-run behavior; the contract suite should add event ordering and bounded-read contracts. |

Confirmed direct `openAppStateDatabase` call sites that block repository-interface freeze:

- `packages/core/src/control-plane/plugins/local-loader.ts`
- `packages/core/src/control-plane/services.ts`
- `packages/core/src/control-plane/services/workflow-template-catalog.ts`
- `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts`
- `packages/core/src/control-plane/services/workflow-queue-status.ts`
- `packages/core/src/control-plane/services/repositories.ts`
- `packages/core/src/control-plane/services/model-providers.ts`
- `packages/core/src/control-plane/services/agent-catalog.ts`
- `packages/core/src/control-plane/services/task-workbench.ts`
- `packages/core/src/control-plane/services/workflow-status.ts`
- `packages/core/src/control-plane/services/workflow-dag-executor.ts`
- `packages/core/src/control-plane/services/worker-heartbeats.ts`
- `packages/core/src/control-plane/services/operations.ts`
- `packages/core/src/control-plane/services/local-services.ts`
- `packages/core/src/control-plane/services/mission-workbench.ts`

Step 1 of the migration should replace these direct opens with injected repository/app-state providers before a Postgres adapter is introduced.

## Step-1 Direct App-State Open Inventory

Live command:
`grep -rn "openAppStateDatabase" packages/core/src --include='*.ts' | grep -v "app-state/index"`.

| File:line | Enclosing service/method | Already-injectable seam? | Conversion note |
| --- | --- | --- | --- |
| `packages/core/src/control-plane/plugins/local-loader.ts:153` | `indexConfiguredLocalPlugins` | Yes | Already accepts `options.appState`; make callers supply the app-state provider instead of opening locally. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:37` | `SqliteHarnessProfileStateStore.listDirectives` | No | Convert the state-store wrapper to receive app-state or directive repositories. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:46` | `SqliteHarnessProfileStateStore.createDirective` | No | Same state-store cluster as above. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:55` | `SqliteHarnessProfileStateStore.listRunTemplates` | No | Same state-store cluster as above. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:64` | `SqliteHarnessProfileStateStore.createRunTemplate` | No | Same state-store cluster as above. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:129` | `SqliteHarnessProfileStateStore.listHarnessProfiles` | No | Same state-store cluster as above. |
| `packages/core/src/control-plane/state-store/sqlite-harness-profile-state-store.ts:138` | `SqliteHarnessProfileStateStore.createHarnessProfile` | No | Same state-store cluster as above. |
| `packages/core/src/control-plane/services.ts:200` | `createLocalControlPlaneServices` startup recovery | No | Composition root opens app-state for plugin indexing and stale-run recovery; pass a provider through service construction. |
| `packages/core/src/control-plane/services.ts:257` | `createLocalControlPlaneServices` durable memory storage | No | Composition root opens the SQLite app-state database to construct durable-memory storage; separate storage/provider injection. |
| `packages/core/src/control-plane/services/model-providers.ts:158` | `LocalModelProviderService.withAppState` | No | Hard helper-local open; add an injected app-state/repository option. |
| `packages/core/src/control-plane/services/local-services.ts:1145` | `LocalScheduleService.withAppState` | Yes | Already checks `this.options.appState`; make the option mandatory or provider-backed. |
| `packages/core/src/control-plane/services/local-services.ts:1157` | `LocalScheduleService.withAppStateAsync` | Yes | Same schedule-service seam as above. |
| `packages/core/src/control-plane/services/task-workbench.ts:1023` | `LocalTaskWorkbenchService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/task-workbench.ts:1035` | `LocalTaskWorkbenchService.withAppStateAsync` | Yes | Same task-workbench seam as above. |
| `packages/core/src/control-plane/services/repositories.ts:192` | `LocalRepositoryService.withAppState` | No | Hard helper-local open; add an injected app-state/repository option. |
| `packages/core/src/control-plane/services/repositories.ts:201` | `LocalRepositoryService.withAppStateAsync` | No | Same repository-service helper cluster as above. |
| `packages/core/src/control-plane/services/workflow-queue-status.ts:82` | `LocalWorkflowQueueStatusService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/workflow-template-catalog.ts:230` | `LocalWorkflowTemplateCatalogService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/workflow-template-catalog.ts:242` | `LocalWorkflowTemplateCatalogService.withAppStateAsync` | Yes | Same workflow-template seam as above. |
| `packages/core/src/control-plane/services/operations.ts:420` | `LocalOperationsService.listUsageLedgerRows` | No | Hard open inside read helper with catch-and-empty behavior; inject usage-ledger repository and preserve fallback semantics explicitly. |
| `packages/core/src/control-plane/services/mission-workbench.ts:291` | `LocalMissionWorkbenchService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/mission-workbench.ts:303` | `LocalMissionWorkbenchService.withAppStateAsync` | Yes | Same mission-workbench seam as above. |
| `packages/core/src/control-plane/services/workflow-status.ts:31` | `LocalWorkflowStatusService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/workflow-dag-executor.ts:137` | `LocalWorkflowDagExecutor.withAppStateAsync` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/worker-heartbeats.ts:45` | `LocalWorkerHeartbeatService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/services/agent-catalog.ts:116` | `LocalAgentCatalogService.withAppState` | Yes | Already checks `this.options.appState`; replace fallback open with injected provider. |
| `packages/core/src/control-plane/app-state/database.ts:73` | `openAppStateDatabase` factory definition | N/A | Not a service conversion target; retained so the count matches the live grep command. |

The live inventory has 27 grep hits. Of those, 26 are service/state-store call
sites that directly open app-state; 14 already have an `options.appState` seam
and can be converted cheaply by requiring or provider-injecting that dependency.
The largest conversion units are the six-hit
`sqlite-harness-profile-state-store.ts` cluster, the two composition-root opens
in `services.ts`, and the service helpers that still have no injectable app-state
option (`model-providers.ts`, `repositories.ts`, and `operations.ts`).
