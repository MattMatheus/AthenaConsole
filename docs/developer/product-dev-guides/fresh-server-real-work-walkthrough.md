# Fresh Server Real-Work Walkthrough

This walkthrough proves the local-server path end to end: a clean server checkout, durable storage, safe secrets, repository connection, one useful agent run, artifact inspection, and basic recovery notes.

Use it for a trusted home or lab LAN. It is not an internet-facing production deployment guide.

## Prerequisites

On the server:

- Linux host with Docker Engine and Docker Compose, or Podman with Podman Compose.
- Git.
- Enough disk for app state, artifacts, cloned repositories, plugins, and container images.
- A trusted LAN, firewall, or VPN boundary if binding ports beyond loopback.

On your workstation:

- Browser access to the server console port.
- The Team Orchestrator repository URL.
- A public HTTP(S) Git URL or absolute local Git path for the target repo you want to inspect.

The walkthrough uses the deterministic `repo-summary` sample agent, so a model provider is optional. Provider setup is included for the point where you want model-backed agents.

## 1. Prepare Host Paths

Create durable host-owned paths before boot. The examples use `/srv/team-orchestrator`; choose paths that match your server backup model.

```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" \
  /srv/team-orchestrator/workspace \
  /srv/team-orchestrator/state \
  /srv/team-orchestrator/artifacts \
  /srv/team-orchestrator/repos \
  /srv/team-orchestrator/plugins \
  /srv/team-orchestrator/secrets
```

These paths map to:

- `/athena/workspace` for runtime workspace files.
- `/athena/state` for SQLite app-state and support state.
- `/athena/state/run-evidence`, `/athena/state/transcripts`, `/athena/state/specialist-runs`, and `/athena/state/persona-runs` for artifacts.
- `/athena/workspace/repos` for managed repository clones.
- `/athena/plugins` for operator-supplied plugins.
- `/run/secrets/athena` for read-only local-file provider secrets.

## 2. Clone Team Orchestrator

```bash
git clone <team-orchestrator-repo-url> AthenaConsole
cd AthenaConsole
```

Copy the server environment template:

```bash
cp server.env.example server.env
```

Edit `server.env` before first boot:

- Set `ATHENA_AUTH_API_TOKEN` to a long random API token.
- Set `ATHENA_CONSOLE_PASSWORD` to the password operators will use in the browser.
- Keep `ATHENA_SERVER_BIND_ADDRESS=127.0.0.1` unless the server is protected by LAN firewall or VPN rules you control.
- Confirm every `ATHENA_SERVER_*_PATH` points at the durable host paths created above.
- Confirm `ATHENA_SERVER_DOCKER_SOCKET` points at the container runtime socket used by the server.
- Keep `ATHENA_SANDBOX_WORKSPACE_HOST_PATH` aligned with the host path that backs `/athena/workspace`.

## 3. Seed The Example Plugin

The server profile indexes `/athena/plugins`. Copy the repo-summary sample plugin into the host plugin path so the API can load a useful local agent:

```bash
rsync -a sample-plugins/repo-summary/ /srv/team-orchestrator/plugins/repo-summary/
```

The plugin provides:

- Plugin id: `team-orchestrator.samples.repo-summary`
- Agent id: `repo.summary.local`
- Capability: `repo.summarize`
- Runtime: local command, read-only repository inspection, no model provider required.

## 4. Add Provider Secrets When Needed

Skip this section for the repo-summary sample run. It uses the mock/local deterministic path.

For model-backed agents, prefer local-file secrets under the server secret path. Example:

```bash
printf '%s' '<provider-api-key>' > /srv/team-orchestrator/secrets/openai-api-key
chmod 0600 /srv/team-orchestrator/secrets/openai-api-key
```

After the stack starts, open `http://127.0.0.1:5173/settings` and add an OpenAI-compatible provider that references:

```json
{ "kind": "local-file", "name": "/run/secrets/athena/openai-api-key" }
```

Do not paste provider keys into docs, screenshots, shell history, or committed environment files.

## 5. Start The Server Stack

Docker Compose:

```bash
docker compose --env-file server.env -f docker-compose.server.yml up --build -d
```

Podman Compose:

```bash
podman compose --env-file server.env -f docker-compose.server.yml up --build -d
```

Load environment values for API smoke commands in the current shell:

```bash
set -a
. ./server.env
set +a
export ATHENA_SERVER_URL="http://${ATHENA_SERVER_BIND_ADDRESS}:${ATHENA_SERVER_API_PORT}"
```

Use the API token and console identity on authenticated API calls:

```bash
curl -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  "${ATHENA_SERVER_URL}/api/v1/health"
```

## 6. Check Deployment Readiness

```bash
curl -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  "${ATHENA_SERVER_URL}/api/v1/readiness"
```

Expected result:

- `api`, `app-state`, `artifact-storage`, `managed-repo-root`, `plugin-paths`, `plugins`, `runtime`, and `server-exposure` are `ok`.
- `secret-root` is `ok` when `/run/secrets/athena` is mounted and readable.
- `model-providers` may be `degraded` until you add a provider in Settings.
- Every non-`ok` check includes a `nextStep`.

Open the console:

```text
http://127.0.0.1:5173
```

Use `ATHENA_CONSOLE_PASSWORD` from `server.env`. The dashboard readiness panel should show pass/warn/fail rows for the same checks.

## 7. Connect A Target Repository

Option A: managed public HTTP(S) clone through the API:

```bash
curl -X POST "${ATHENA_SERVER_URL}/api/v1/repositories" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  -H "content-type: application/json" \
  -d '{
    "id": "target-repo",
    "name": "Target Repo",
    "sourceType": "managed-clone",
    "remoteUrl": "<public-git-repo-url>"
  }'
```

The managed clone path will be:

```text
/athena/workspace/repos/managed/target-repo
```

Option B: existing path mounted into the API container:

```bash
curl -X POST "${ATHENA_SERVER_URL}/api/v1/repositories" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  -H "content-type: application/json" \
  -d '{
    "id": "target-repo",
    "name": "Target Repo",
    "sourceType": "existing-path",
    "workspacePath": "/athena/workspace/repos/existing/target-repo",
    "hostPath": "/srv/team-orchestrator/repos/existing/target-repo"
  }'
```

You can also use the console at `http://127.0.0.1:5173/resources` to create, inspect, and select repository records.

Confirm the repository is ready:

```bash
curl -X POST "${ATHENA_SERVER_URL}/api/v1/repositories/target-repo/inspect" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

## 8. Confirm The Agent Is Loaded

```bash
curl "${ATHENA_SERVER_URL}/api/v1/agent-catalog/agents?capabilities=repo.summarize" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

Expected data includes `repo.summary.local` and `available: true`.

In the console, open:

```text
http://127.0.0.1:5173/agents
```

## 9. Run Useful Repo Work

Create a ready task for the repo-summary agent:

```bash
curl -X POST "${ATHENA_SERVER_URL}/api/v1/tasks" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  -H "content-type: application/json" \
  -d '{
    "id": "task-fresh-server-repo-summary",
    "title": "Summarize target repository",
    "status": "ready",
    "capabilityRequirements": ["repo.summarize"],
    "assignedAgentId": "repo.summary.local",
    "assignedAgentVersion": "0.1.0",
    "inputs": {
      "repo": {
        "path": "/athena/workspace/repos/managed/target-repo"
      },
      "maxFiles": 200
    }
  }'
```

If you used an existing-path repository, replace the `inputs.repo.path` value with that repository's `workspacePath`.

Run the task:

```bash
curl -X POST "${ATHENA_SERVER_URL}/api/v1/tasks/task-fresh-server-repo-summary/run" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  -H "content-type: application/json" \
  -d '{}'
```

The response includes a task run id. Inspect it:

```bash
curl "${ATHENA_SERVER_URL}/api/v1/task-runs/<task-run-id>" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

Expected result:

- Run status is `completed`.
- Output includes a `Repo summary` markdown artifact.
- Artifact metadata points at durable artifact storage under the server paths.

In the console:

- Open `http://127.0.0.1:5173/tasks` to see the task.
- Open `http://127.0.0.1:5173/sessions` to inspect run/session history.
- Open `http://127.0.0.1:5173/resources` to confirm the connected repo remains inspectable.

## 10. Stop, Backup, And Restore

Stop without deleting host data:

```bash
docker compose --env-file server.env -f docker-compose.server.yml down
```

Podman Compose:

```bash
podman compose --env-file server.env -f docker-compose.server.yml down
```

Do not pass `-v` unless you intentionally want Docker-managed resources removed. The important state lives in host paths.

Back up the durable paths while the stack is stopped:

```bash
tar -C /srv -czf team-orchestrator-backup.tgz team-orchestrator
```

Restore on the same or replacement server:

```bash
sudo install -d -m 0750 -o "$USER" -g "$USER" /srv/team-orchestrator
tar -C /srv -xzf team-orchestrator-backup.tgz
cd AthenaConsole
docker compose --env-file server.env -f docker-compose.server.yml up --build -d
```

After restore, check:

```bash
curl -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console" \
  "${ATHENA_SERVER_URL}/api/v1/readiness"

curl "${ATHENA_SERVER_URL}/api/v1/repositories" \
  -H "authorization: Bearer ${ATHENA_AUTH_API_TOKEN}" \
  -H "x-athena-identity: console"
```

The restored stack should retain SQLite app-state, repository records, managed clones, plugins, provider configs, and artifact metadata/payloads that were included in the host path backup.
