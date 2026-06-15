<!-- AUDIENCE: Admin/Enterprise -->

# Install and Deploy

Team Orchestrator runs in three deployment profiles: local workbench, trusted server, and production. All three share the same codebase; the profile is determined by the compose file and environment variables you use.

---

## Prerequisites

- Node.js 20+
- Podman or Docker with Compose support
- Git

---

## Local Workbench

The local workbench profile is the fastest way to get started on a single machine. It runs the API and console in containers with a mock-friendly configuration.

Clone and start:

```bash
git clone <your-repo-url>
cd AthenaConsole
npm install
podman compose -f docker-compose.local.yml up --build
```

Or with Docker Compose:

```bash
docker compose -f docker-compose.local.yml up --build
```

Default local URLs:

- API: `http://127.0.0.1:8787`
- Console: `http://127.0.0.1:5173`

The local compose file sets `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true` explicitly. Do not use that flag for LAN or shared deployments.

---

## Trusted-Server Profile

The trusted-server profile is for a shared LAN or team server where all users are trusted (no public exposure). See the full guide at [Local Server Deployment](../developer/product-dev-guides/local-server-deployment.md).

Key differences from local:

```bash
docker compose -f docker-compose.server.yml up --build
```

- `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED` is NOT set; the server expects a trusted proxy to forward identity.
- See [Trusted Proxy Auth](../developer/product-dev-guides/trusted-proxy-auth.md) for proxy header configuration.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

---

## Production Profile

For production-like deployments:

```bash
docker compose -f docker-compose.prod.yml up --build
```

The production compose adds volume mounts for durable SQLite state and configures stricter defaults. Review the file for required environment variables before running.

---

## Direct Development Start

For local development without containers, start the API directly:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

The console dev server proxies `/api/*` to the API process. Start both in separate terminals or use `dev.sh`:

```bash
./dev.sh
```

---

## Health and Readiness

After the API starts, verify it:

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:8787/api/v1/readiness
```

Health returns `ok: true` when the API process is running.

Readiness returns a status of `ready` or `degraded` with per-check details. A degraded status is not always fatal — read each check's `nextStep`. Optional provider checks may be degraded until you configure credentials.

Common readiness checks:

| Check | Common Cause of Degraded |
|-------|--------------------------|
| plugin-path | No plugin path configured or path not found |
| first-run-demo | Sample demo plugin missing from expected path |
| app-state | App-state path is not writable |
| provider | A model provider required by a loaded agent is not configured |

---

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `ATHENA_WORKSPACE_ROOT` | Root directory for app state, plugins, and relative paths |
| `ATHENA_PLUGIN_PATHS` | Colon-separated list of plugin parent directories |
| `ATHENA_DEFAULT_PROVIDER` | Default model provider (`openai`, `foundry`) |
| `ATHENA_OPENAI_API_KEY` | API key for OpenAI-compatible providers |
| `ATHENA_OPENAI_BASE_URL` | Base URL for OpenAI-compatible APIs (default: `https://api.openai.com/v1`) |
| `ATHENA_FOUNDRY_PROJECT_ENDPOINT` | Azure AI Foundry project endpoint URL |
| `ATHENA_FOUNDRY_DEPLOYMENT` | Azure AI Foundry deployment name |
| `ATHENA_FOUNDRY_USE_ENTRA_ID` | Use `DefaultAzureCredential` for Foundry auth (default: `true`) |
| `ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED` | Allow unauthenticated external requests (local only) |
| `ATHENA_REPO_HOST_PATH` | Host path of a target repository for container mounts |
| `ATHENA_REPO_CONTAINER_PATH` | Container path of a target repository |
| `ATHENA_EVENTS_MAX_RECORDS` | Max event records in ledger (default: 10,000) |
| `ATHENA_EVENT_RETENTION_DAYS` | Event retention in days before pruning (default: 30) |

See `server.env.example` in the repo root for a full template.

---

## Next Steps

- [Workspaces and Multiplayer](03-workspaces-and-multiplayer.md) — set up workspaces for team operation
- [Running Work](05-running-work.md) — run the first-run demo to confirm the setup
- [Troubleshooting](09-troubleshooting.md) — common startup failures
