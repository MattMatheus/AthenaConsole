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

The API image also packages AthenaAgent from the sibling `../AthenaAgent` source tree through the `athena_agent` Docker build context. Keep both repositories checked out under the same parent directory before building the server profile:

```text
Repos/
  AthenaConsole/
  AthenaAgent/
```

## Persistent Paths

The compose profile uses host-owned paths so backups and permissions are explicit:

| Host env var | Container path | Owns |
| --- | --- | --- |
| `ATHENA_SERVER_WORKSPACE_PATH` | `/athena/workspace` | Runtime workspace root and support files. |
| `ATHENA_SERVER_STATE_PATH` | `/athena/state` | SQLite app-state, locks, sessions, and support state. |
| `ATHENA_SERVER_ARTIFACTS_PATH` | `/athena/state/run-evidence`, `/athena/state/transcripts`, `/athena/state/agent-runs` | File artifact payloads that should survive container replacement. |
| `ATHENA_SERVER_REPOS_PATH` | `/athena/workspace/repos` | Managed Git clones created from the console/API. |
| `ATHENA_SERVER_PLUGINS_PATH` | `/athena/plugins` | Operator-supplied plugin packages. |
| `ATHENA_SERVER_SECRETS_PATH` | `/run/secrets/athena` | Local secret files mounted read-only into the API container. |

Use absolute host paths on a real server. The checked-in example uses `/srv/team-orchestrator/...` because Docker-backed sandbox settings also need a host path that is meaningful to the Docker daemon.

## Secrets

The compose file requires `ATHENA_AUTH_API_TOKEN` and `ATHENA_CONSOLE_PASSWORD`, but it does not contain their values. Keep them in your untracked `server.env` or in your server's secret manager.

The local-server profile uses `ATHENA_AUTH_API_TOKEN` plus the trusted `x-athena-identity` header. That header is a pilot identity assertion for a trusted console, service, or reverse proxy. Do not expose the API to untrusted clients that can choose arbitrary `x-athena-identity` values. If you put a proxy in front of the API, strip any inbound identity header from clients and inject only the identity values the proxy has authenticated. The checked-in server profile represents `console:Admin`, `operator:Operator`, `healthcheck:Viewer`, and `*:Viewer`.

For model provider keys, prefer local-file secret references in the console using files under `/run/secrets/athena`. For example, if the host file is:

```text
$ATHENA_SERVER_SECRETS_PATH/openai-api-key
```

then configure the provider secret as:

```json
{ "kind": "local-file", "name": "/run/secrets/athena/openai-api-key" }
```

Environment variables such as `ATHENA_OPENAI_API_KEY` are supported for compatibility, but local-file references make ownership and backups easier to reason about.

## Durable Memory

Durable product memory is separate from the legacy diagnostic memory search routes under `/api/v1/memory/*`. The durable-memory API lives under `/api/v1/durable-memory/*`, and readiness reports it as its own provider-style check so operators can distinguish disabled memory, local-only memory, and remote-memory fallback states.

The default mode is disabled. For a local server that owns the durable-memory store, set server mode in `server.env`:

```bash
ATHENA_DURABLE_MEMORY_MODE=server-mode
ATHENA_DURABLE_MEMORY_CACHE_MODE=disabled
```

For a laptop or another node that should use the server's memory API, configure remote HTTP mode and reference the token without placing the token value in diagnostics:

```bash
ATHENA_DURABLE_MEMORY_MODE=remote-http
ATHENA_DURABLE_MEMORY_REMOTE_URL=http://server-hostname:8787
ATHENA_DURABLE_MEMORY_TOKEN_ENV=ATHENA_AUTH_API_TOKEN
ATHENA_DURABLE_MEMORY_CACHE_MODE=read-through
```

Use `ATHENA_DURABLE_MEMORY_TOKEN_FILE=/run/secrets/athena/durable-memory-token` when the token is mounted as a file. Configure only one durable-memory token reference.

Back up the host path behind `ATHENA_SERVER_STATE_PATH`; the MVP durable-memory tables live with the app-state SQLite database in that state volume. Do not copy the database between active servers. Stop the stack or use a SQLite-safe backup process, then include the matching artifact and repository paths when restoring a whole Team Orchestrator server.

Readiness uses operator-visible statuses for fallback behavior: `remote-current` and `cache-current` are clean, while `remote-unavailable`, `cache-stale`, `queued-intent`, and `conflict-review-required` tell the operator whether to reconnect, replay queued writes, or review conflicts before memory-dependent agents run. `local-dev-only` is expected for laptop-only experiments and should not be treated as cross-machine continuity.

## Repositories And Plugins

Managed repository clones are written under `/athena/workspace/repos/managed`, backed by `ATHENA_SERVER_REPOS_PATH`. Existing-path repositories should use container paths that are mounted into the API container. If an agent or task needs the same path from a Docker-backed sandbox, keep `ATHENA_SANDBOX_WORKSPACE_HOST_PATH` aligned with the host path that backs `/athena/workspace`.

Plugin search uses both `/athena/plugins` and the built-in sample plugins in the image. Drop custom plugin directories into `ATHENA_SERVER_PLUGINS_PATH`, then recreate the API container or restart the stack so startup indexing sees them.

## AthenaAgent Runtime

The server API container carries a Python 3.11+ virtual environment at `/opt/athena-agent-venv` and an installed AthenaAgent source tree at `/opt/athena-agent-src`. The bundled software-team `athena-agent.repo-summary` agent uses those paths through:

```bash
ATHENA_AGENT_REPO=/opt/athena-agent-src
ATHENA_AGENT_PYTHON=/opt/athena-agent-venv/bin/python
```

After the stack is healthy, verify the packaged runner without using a developer shell on the host:

```bash
docker compose --env-file server.env -f docker-compose.server.yml exec api \
  /opt/athena-agent-venv/bin/python -c "import athena_agent.console_runner; print('athena-agent-runtime-ok')"
```

Then confirm the Console catalog sees the model-backed agent:

```bash
curl "${ATHENA_SERVER_URL:-http://127.0.0.1:8787}/api/v1/agent-catalog/agents?capabilities=repo.summary" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

Before a model provider is configured, `athena-agent.repo-summary` should be present but blocked by provider readiness. After adding a provider in Settings with a secret under `/run/secrets/athena`, run an AthenaAgent-backed repository summary task from the console. This proves provider egress from inside the API container because the request is made by the packaged runtime, not the host shell.

To prove restart durability, note the completed task run id, restart the stack, and fetch the same run again:

```bash
docker compose --env-file server.env -f docker-compose.server.yml restart api console
curl "${ATHENA_SERVER_URL:-http://127.0.0.1:8787}/api/v1/task-runs/<run-id>" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

The run status, events, artifact metadata, and artifact preview should still be available because app state and run artifacts live under the host-owned `ATHENA_SERVER_STATE_PATH` and `ATHENA_SERVER_ARTIFACTS_PATH` mounts.

## Stop

```bash
docker compose --env-file server.env -f docker-compose.server.yml down
```

Do not pass `-v` unless you intentionally want Docker-managed resources removed. Host paths under `ATHENA_SERVER_*_PATH` remain on disk either way.
