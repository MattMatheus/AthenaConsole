# Deployment Automation

Team Orchestrator currently supports local development, production-like local validation, and trusted-LAN local-server installs. Deployment automation should verify that delivery path. It should not deploy Azure, AKS, ACR, Static Web Apps, or other cloud resources unless a future cloud deployment epic explicitly reintroduces that scope.

## Decision

Rebuild deployment automation around the current local-server model.

- Keep root GitHub Actions only. Nested workflows are treated as archived planning context, not active automation.
- Validate current TypeScript surfaces, generated schemas, PDK package behavior, and Docker Compose syntax.
- Use `docker-compose.local.yml` and `docker-compose.server.yml` as the deployment contract for CI checks.
- Keep real service startup smoke testing as a local/operator command because it needs Docker daemon behavior, bind ports, and server secrets that vary by host.

## Active Workflow

The root workflow is `.github/workflows/local-server-validation.yml`.

It runs:

```bash
npm ci
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run check:schemas
npm --workspace @athena/pdk test
npm --workspace @athena/console run typecheck
docker compose -f docker-compose.local.yml config
docker compose -f docker-compose.server.yml config
npm run smoke:product -- --help
```

The compose checks use CI-only placeholder secrets so the server profile can be validated without publishing credentials. The server compose build also expects a sibling `../AthenaAgent` build context for the API image's packaged model-backed runtime.

## Local Server Smoke

After changing deployment docs, compose files, auth defaults, sample plugins, or first-run workflow behavior, run a real local-server smoke on a machine with Docker or Podman:

```bash
cp server.env.example server.env
docker compose --env-file server.env -f docker-compose.server.yml up --build -d
docker compose --env-file server.env -f docker-compose.server.yml exec api \
  /opt/athena-agent-venv/bin/python -c "import athena_agent.console_runner; print('athena-agent-runtime-ok')"
npm run smoke:product -- --api-base-url http://127.0.0.1:8787 --api-token "$ATHENA_AUTH_API_TOKEN" --identity console
docker compose --env-file server.env -f docker-compose.server.yml down
```

Use Podman Compose with the same arguments when that is the local container runtime and it supports Compose additional build contexts. The AthenaAgent import check proves the server image does not depend on a developer-managed Python environment.

## Out Of Scope

- Push-to-cloud deploys.
- Container registry publishing.
- Kubernetes rollout automation.
- Cloud secret provisioning.
- Hosted multi-tenant production checks.

Those paths need fresh architecture and security decisions before automation is added.
