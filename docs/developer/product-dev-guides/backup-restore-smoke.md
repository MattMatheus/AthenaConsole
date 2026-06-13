# Backup Restore Smoke

Use this smoke when validating trusted-LAN server upgrades.

## Backup Contents

- SQLite app-state database.
- Run evidence and artifact directory.
- Managed repository metadata and checked-out repos if the server owns them.
- Plugin package directory.
- Durable-memory server storage when running in server mode.
- Secret references and secret file names, but not copied secret values unless handled by the operator's secret manager.

## Restore Procedure

1. Stop the API and console containers.
2. Copy app-state, artifacts, repos, plugins, and durable-memory storage into a clean server directory.
3. Recreate secret files or remount the secret manager at `/run/secrets/athena`.
4. Start the stack with the restored paths.
5. Call `/api/v1/readiness` and verify app-state, artifacts, repos, plugins, providers, memory, and security checks.
6. Open the console and verify users/roles, provider records, runs, artifacts, memory proposals, and audit trail.

## Pass Criteria

- Existing role assignments are present.
- Provider records remain redacted and testable after secret remount.
- Historical runs and artifacts open.
- Durable-memory records/proposals are visible.
- Governance audit history includes pre-restore records and a post-restore validation event or operator note.
