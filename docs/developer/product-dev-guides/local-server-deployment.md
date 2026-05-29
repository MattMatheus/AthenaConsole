# Local Server Deployment

Use `docker-compose.server.yml` when Team Orchestrator should run on a durable local server instead of a laptop dev process. This profile is for a trusted home or lab LAN. It is not an internet-facing production profile.

For the full clean-server path through repo connection, a useful sample agent run, artifact inspection, and backup/restore, use [Fresh Server Real-Work Walkthrough](fresh-server-real-work-walkthrough.md).

## Start

Copy the example environment and edit every secret or host path before first boot:

```bash
cp server.env.example server.env
docker compose --env-file server.env -f docker-compose.server.yml up --build -d
```

Podman Compose works too:

```bash
podman compose --env-file server.env -f docker-compose.server.yml up --build -d
```

The default bind address is `127.0.0.1`, so the console is available on the server at `http://127.0.0.1:5173`. Set `ATHENA_SERVER_BIND_ADDRESS=0.0.0.0` only when the server is protected by LAN firewall or VPN controls you operate.

## Persistent Paths

The compose profile uses host-owned paths so backups and permissions are explicit:

| Host env var | Container path | Owns |
| --- | --- | --- |
| `ATHENA_SERVER_WORKSPACE_PATH` | `/athena/workspace` | Runtime workspace root and support files. |
| `ATHENA_SERVER_STATE_PATH` | `/athena/state` | SQLite app-state, locks, sessions, and support state. |
| `ATHENA_SERVER_ARTIFACTS_PATH` | `/athena/state/run-evidence`, `/athena/state/transcripts`, `/athena/state/specialist-runs`, `/athena/state/persona-runs` | File artifact payloads that should survive container replacement. |
| `ATHENA_SERVER_REPOS_PATH` | `/athena/workspace/repos` | Managed Git clones created from the console/API. |
| `ATHENA_SERVER_PLUGINS_PATH` | `/athena/plugins` | Operator-supplied plugin packages. |
| `ATHENA_SERVER_SECRETS_PATH` | `/run/secrets/athena` | Local secret files mounted read-only into the API container. |

Use absolute host paths on a real server. The checked-in example uses `/srv/team-orchestrator/...` because Docker-backed sandbox settings also need a host path that is meaningful to the Docker daemon.

## Secrets

The compose file requires `ATHENA_AUTH_API_TOKEN` and `ATHENA_CONSOLE_PASSWORD`, but it does not contain their values. Keep them in your untracked `server.env` or in your server's secret manager.

For model provider keys, prefer local-file secret references in the console using files under `/run/secrets/athena`. For example, if the host file is:

```text
$ATHENA_SERVER_SECRETS_PATH/openai-api-key
```

then configure the provider secret as:

```json
{ "kind": "local-file", "name": "/run/secrets/athena/openai-api-key" }
```

Environment variables such as `ATHENA_OPENAI_API_KEY` are supported for compatibility, but local-file references make ownership and backups easier to reason about.

## Repositories And Plugins

Managed repository clones are written under `/athena/workspace/repos/managed`, backed by `ATHENA_SERVER_REPOS_PATH`. Existing-path repositories should use container paths that are mounted into the API container. If an agent or task needs the same path from a Docker-backed sandbox, keep `ATHENA_SANDBOX_WORKSPACE_HOST_PATH` aligned with the host path that backs `/athena/workspace`.

Plugin search uses both `/athena/plugins` and the built-in sample plugins in the image. Drop custom plugin directories into `ATHENA_SERVER_PLUGINS_PATH`, then recreate the API container or restart the stack so startup indexing sees them.

## Stop

```bash
docker compose --env-file server.env -f docker-compose.server.yml down
```

Do not pass `-v` unless you intentionally want Docker-managed resources removed. Host paths under `ATHENA_SERVER_*_PATH` remain on disk either way.
