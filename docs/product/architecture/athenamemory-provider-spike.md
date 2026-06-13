# AthenaMemory Provider Spike

Recommendation: use a sidecar service before a direct import/sync adapter.

## Mapping

| Console Concept | AthenaMemory Concept | Notes |
| --- | --- | --- |
| Namespace scope | Domain | Console scopes are hierarchical; map to stable domain strings such as `repo:<owner>/<name>` or `project:<id>`. |
| Provenance | Record metadata | Preserve run id, artifact id, task id, actor, and source URI as metadata. |
| Sensitivity | Tags/metadata | Keep `secret-adjacent` explicit and default it to proposal review. |
| Proposal review | CLI-governed write path today | HTTP gateway is read-only, so reviewed writes need sidecar or CLI bridge. |
| Snapshots | CLI snapshots | Expose snapshot request/status through sidecar rather than Console writing files directly. |

## Demonstrated Path

- Read/search can use AthenaMemory `serve-read-gateway` through Console's remote HTTP provider shape.
- Proposal-to-reviewed-write is blocked by the current read-only gateway. The safe bridge is a sidecar that exposes reviewed write/snapshot commands and records audit metadata.

## Recommendation

Choose sidecar service. It keeps AthenaMemory governance intact, avoids importing CLI internals into Console, and gives a future place for write/snapshot APIs without turning Console into the memory database owner.
