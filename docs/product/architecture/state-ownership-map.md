<!-- AUDIENCE: Internal/Technical -->

# State Ownership Map

## Status

Active architecture map for the State Ownership and SQLite Migration epic.

## Source Decisions

- `docs/product/architecture/decisions/0010-sqlite-app-state-architecture.md`
- `docs/product/architecture/decisions/0012-event-artifact-observability-model.md`
- `docs/product/architecture/decisions/0015-canonical-orchestration-state-model.md`
- `docs/product/architecture/decisions/0016-core-service-decomposition-plan.md`

## Ownership Policy

SQLite is the canonical local app-state store for operator-facing control-plane records. Filesystem storage remains valid for source manifests, large artifact payloads, transcripts, logs, and local planning documents.

Deprecated file-backed control-plane state should be migrated forward or removed. Do not add read bridges, file-store fallbacks, or long-term compatibility shims for deprecated control-plane state.

State classifications mean:

- SQLite app-state: durable operator-facing records whose source of truth is the app-state database.
- SQLite app-state index: queryable metadata stored in SQLite while large or source-of-truth payload files remain on disk.
- Intentional file artifact: payload bytes, transcripts, generated reports, evidence files, and other inspectable outputs that should remain filesystem-owned.
- Intentional file support state: local runtime support files that are not product control-plane records.
- Deprecated file-backed state to remove: old control-plane state that must not gain compatibility bridges or new read paths.

## Current Domains

| Domain | Current owner | Classification | Next action |
| --- | --- | --- | --- |
| App-state migrations | SQLite, `app_state_migrations` | SQLite app-state | Keep in SQLite. |
| App settings | SQLite, `app_settings` | SQLite app-state | Keep in SQLite. |
| Plugin catalog index | SQLite, `plugin_index` | SQLite app-state index | Keep source files on disk and index metadata in SQLite. |
| Agent catalog index | SQLite, `agent_index` | SQLite app-state index | Keep source files on disk and index metadata in SQLite. |
| Workflow template catalog | SQLite, `workflow_template_index` | SQLite app-state index | Keep plugin workflow manifests as source files and index operator metadata in SQLite. |
| Tasks | SQLite, `tasks` | SQLite app-state | Keep in SQLite. |
| Missions | SQLite, `missions` | SQLite app-state | Keep in SQLite. |
| Task and mission runs | SQLite, `runs` | SQLite app-state | Keep in SQLite. |
| Run events | SQLite, `run_events` | SQLite app-state | Keep in SQLite. |
| Artifact metadata | SQLite, `artifact_metadata` | SQLite app-state index | Keep metadata in SQLite; payload bytes remain filesystem-owned. Add indexes only for console/API query needs. |
| Approvals and safety decisions | SQLite, `approvals` | SQLite app-state | Keep in SQLite. |
| Schedules | SQLite, `schedules` | SQLite app-state | Keep in SQLite. |
| Schedule history | SQLite, `schedule_run_history` | SQLite app-state | Keep in SQLite, including workflow DAG run correlation. |
| Workflow DAG runs | SQLite, `workflow_dag_runs` | SQLite app-state | Keep in SQLite as canonical workflow execution identity. |
| Workflow DAG steps | SQLite, `workflow_dag_run_steps` | SQLite app-state | Keep in SQLite. |
| Workflow DAG events | SQLite, `workflow_dag_run_events` | SQLite app-state | Keep in SQLite. |
| Directives | SQLite, `directives` | SQLite app-state | Runtime list/create/resolve paths use SQLite. Old `.athena/directives` files are not read by normal runtime paths. |
| Harness profiles | SQLite, `harness_profiles` | SQLite app-state | Runtime list/create/resolve paths use SQLite. Old `.athena/harness-profiles` files are not read by normal runtime paths. |
| Run templates | SQLite, `run_templates` | SQLite app-state | Runtime list/create/run paths use SQLite. Old `.athena/run-templates` files are not read by normal runtime paths. |
| Legacy workflows | `FileStateStore`, `.athena/workflows` and `.athena/workflow-runs` | Deprecated file-backed state to remove | Remove or disable after canonical workflow DAG route coverage is confirmed. |
| Sessions | `SessionStore`, `.athena/sessions` | Intentional file support state | Keep file-backed runtime support records under run-history retention. Consider a future SQLite index only if console search requires it. |
| Transcripts | `SessionStore`, `.athena/transcripts/*.jsonl` | Intentional file artifact | Keep file-backed append-only payloads under session retention; do not store transcript bodies in SQLite. |
| Work queues | `WorkManager`, per-session files | Intentional file support state | Keep file-backed unless work queues become operator-facing durable app-state. |
| Run evidence payloads | `FileStateStore`, `.athena/run-evidence` | Intentional file artifact | Keep file-backed payloads; avoid storing payload bytes in SQLite. Use SQLite metadata only if evidence needs list/search beyond current run verification. |
| Specialist artifacts | `.athena/specialist-runs` and legacy `.athena/persona-runs` | Intentional file artifact | Keep result/report/evidence payloads file-backed. Preserve `specialist-runs` as the primary root; treat `persona-runs` as legacy artifact compatibility until a separate cleanup story scopes removal. Index later only if needed for console query. |
| Plugin and agent source files | Configured plugin directories | Intentional source files | Keep filesystem-owned; SQLite stores app-facing index data. |
| Workflow template source files | Plugin workflow manifests | Intentional source files | Keep filesystem-owned; SQLite stores catalog/index data. |
| Logs | Filesystem or process output | Intentional file artifact/support state | Keep file-backed where streaming files are more practical. |
| Product planning docs | Markdown in repository | Planning documentation | Keep outside runtime app-state. |

## Migration Order

1. Add diagnostics for active state stores and ownership categories.
2. Classify sessions, transcripts, run evidence, and specialist artifacts in docs/tests so artifact payloads do not get pulled into app-state by accident.
3. Remove or disable deprecated file-backed legacy workflow runtime/storage paths after canonical workflow DAG route coverage is confirmed.

## Validation Expectations

| Story | Focused validation |
| --- | --- |
| State store startup diagnostics | Config/server diagnostics tests prove SQLite paths, intentional artifact roots, and deprecated file roots are categorized without exposing secrets. |
| Harness profiles SQLite migration | Harness profile API/service tests plus task/run-template resolution tests prove SQLite is the runtime source of truth. |
| Directives SQLite migration | Directive API/service tests plus task and run-template run-path tests prove directive lookup resolves through SQLite. |
| Run templates SQLite migration | Run-template API/service tests prove list/create/run behavior works through SQLite-owned templates. |
| Session/artifact classification | Docs or ownership-map tests prevent new file-backed control-plane state from appearing without classification. |
| Legacy workflow file-state removal | Workflow DAG API/service tests prove canonical status and graph inspection cover operator needs after deprecated file paths are removed or disabled. |

## Operational Impact

Startup and diagnostics should make the active SQLite database path visible to maintainers. They should also list intentional file artifact roots and any deprecated file-backed roots that still need removal.

Diagnostics may include local filesystem paths for local operator troubleshooting, but they must not include secret values, payload contents, transcript contents, directive contents, or artifact bytes.

## Artifact Retention And Indexing

Session records and transcripts follow the configured run-history retention sweep. When a session record is stale and not locked, its transcript is removed with it.

Artifact payload roots are intentionally inspectable filesystem outputs. SQLite may index payload metadata such as artifact id, run id, label, format, and storage URI, but raw transcript, evidence, result, report, and binary payload bodies should remain outside app-state unless a future ADR explicitly changes the ownership model.
