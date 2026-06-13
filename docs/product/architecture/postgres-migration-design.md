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
