# Plan 042: Remove static admin credentials from the console bundle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report;
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c082a64..HEAD -- docker-compose.server.yml docker-compose.prod.yml packages/core/infrastructure/docker/console.prod.Dockerfile packages/core/infrastructure/docker/console.nginx.prod.conf apps/console/src/services/apiClient.ts apps/console/src/App.tsx apps/console/src`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against live code. If the console no longer embeds API
> credentials in the static bundle, stop and report that this plan is stale.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c082a64`, 2026-06-17

## Why this matters

The trusted-server console currently bakes the API bearer token, trusted
identity, and console password into the Vite static bundle. The API maps the
`console` identity to `Admin`, so anyone who can read the built JavaScript can
recover an Admin-capable API credential and bypass the client-side password gate.
The fix is to keep browser JavaScript credential-free and move API credential
injection plus console access control to the server/proxy layer.

## Current state

Relevant files:

- `docker-compose.server.yml` and `docker-compose.prod.yml` pass secrets as
  console build arguments.
- `packages/core/infrastructure/docker/console.prod.Dockerfile` turns build args
  into Vite environment variables before `npm run build`.
- `apps/console/src/services/apiClient.ts` reads `VITE_ATHENA_API_TOKEN` and
  `VITE_ATHENA_IDENTITY` and sends them with every request.
- `apps/console/src/App.tsx` implements a client-side password check from
  `VITE_CONSOLE_PASSWORD`.
- `packages/core/infrastructure/docker/console.nginx.prod.conf` proxies `/api/`
  to the API container without injecting auth.

Current secret-bearing compose args:

```yaml
# docker-compose.server.yml:61-64
args:
  VITE_ATHENA_API_TOKEN: ${ATHENA_AUTH_API_TOKEN:?Set ATHENA_AUTH_API_TOKEN in server.env}
  VITE_ATHENA_IDENTITY: console
  VITE_CONSOLE_PASSWORD: ${ATHENA_CONSOLE_PASSWORD:?Set ATHENA_CONSOLE_PASSWORD in server.env}
```

Current Docker build bakes those values into the console:

```dockerfile
# packages/core/infrastructure/docker/console.prod.Dockerfile:12-18
ARG VITE_ATHENA_API_TOKEN
ARG VITE_ATHENA_IDENTITY
ARG VITE_CONSOLE_PASSWORD
ENV VITE_ATHENA_API_TOKEN=$VITE_ATHENA_API_TOKEN
ENV VITE_ATHENA_IDENTITY=$VITE_ATHENA_IDENTITY
ENV VITE_CONSOLE_PASSWORD=$VITE_CONSOLE_PASSWORD
RUN npm run build --workspace @athena/console
```

Current browser client sends those static credentials:

```ts
// apps/console/src/services/apiClient.ts:30-34,181-185
this.apiToken = options.apiToken ?? readOptionalEnv("VITE_ATHENA_API_TOKEN");
this.identity = options.identity ?? readOptionalEnv("VITE_ATHENA_IDENTITY");

private authHeaders(): Record<string, string> {
  return {
    ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
    ...(this.identity ? { "x-athena-identity": this.identity } : {})
  };
}
```

Current client-side password gate:

```ts
// apps/console/src/App.tsx:9-12,37-39
const value = import.meta.env.VITE_CONSOLE_PASSWORD?.trim();
if (input === configuredPassword) {
  window.sessionStorage.setItem(SESSION_KEY, "true");
}
```

API profile maps the static `console` identity to Admin:

```yaml
# docker-compose.server.yml:17-21
ATHENA_AUTH_ENABLED: "true"
ATHENA_AUTH_API_TOKEN: ${ATHENA_AUTH_API_TOKEN:?Set ATHENA_AUTH_API_TOKEN in server.env}
ATHENA_AUTH_IDENTITY_ROLE_MAP: console:Admin,operator:Operator,healthcheck:Viewer,*:Viewer
ATHENA_AUTHZ_MODE: enforce
ATHENA_AUTHZ_DEFAULT_DECISION: deny
```

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Console typecheck | `npm --workspace @athena/console run typecheck` | exits 0 |
| Console tests | `npm --workspace @athena/console run test` | exits 0 |
| Console build | `npm --workspace @athena/console run build` | exits 0 |
| Compose config | `docker compose -f docker-compose.server.yml config >/tmp/athena-server-compose.yml` | exits 0 |
| Prod compose config | `docker compose -f docker-compose.prod.yml config >/tmp/athena-prod-compose.yml` | exits 0 |
| Secret grep | `rg -n "VITE_ATHENA_API_TOKEN|VITE_ATHENA_IDENTITY|VITE_CONSOLE_PASSWORD" docker-compose*.yml packages/core/infrastructure/docker apps/console/src` | no matches, unless a test fixture intentionally names removed variables |
| Diff guard | `git diff --check` | exits 0 |

## Scope

**In scope**:

- `apps/console/src/services/apiClient.ts`
- `apps/console/src/App.tsx`
- `apps/console/src/**/*.test.ts*` as needed
- `packages/core/infrastructure/docker/console.prod.Dockerfile`
- `packages/core/infrastructure/docker/console.nginx.prod.conf` or replacement
  Nginx template/entrypoint files in the same directory
- `docker-compose.server.yml`
- `docker-compose.prod.yml`
- Docs only if they explicitly instruct operators to rely on the Vite password
  or embedded console token

**Out of scope**:

- Do not change API RBAC semantics or identity-role mapping beyond the console
  deployment path.
- Do not weaken `ATHENA_AUTH_ENABLED`, `ATHENA_AUTHZ_MODE`, or
  `ATHENA_AUTHZ_DEFAULT_DECISION`.
- Do not put API tokens or passwords into any browser-readable asset, HTML, JS,
  CSS, source map, or Vite environment variable.

## Git workflow

- Branch: `advisor/042-remove-static-console-admin-credentials`
- Commit message: `Move console auth out of static bundle`
- Do not push or open a PR unless the operator asks.

## Steps

### Step 1: Remove browser-side credential support

In `apps/console/src/services/apiClient.ts`, remove `apiToken` and `identity`
from `ApiClientOptions`, constructor state, and `authHeaders()`. Requests should
still call `authHeaders()` or an equivalent helper, but it should return only
non-secret headers required by the browser, or `{}` if none are required.

Update or add console tests that prove API requests do not include
`Authorization` or `x-athena-identity` headers when no explicit non-secret
headers are configured.

**Verify**:

- `rg -n "VITE_ATHENA_API_TOKEN|VITE_ATHENA_IDENTITY|apiToken|x-athena-identity" apps/console/src` returns no production-code matches.
- `npm --workspace @athena/console run typecheck` exits 0.
- `npm --workspace @athena/console run test` exits 0.

### Step 2: Remove the client-side password gate

In `apps/console/src/App.tsx`, remove the `VITE_CONSOLE_PASSWORD` gate and render
`<RouterProvider router={router} />` directly. The browser cannot enforce a
secret for a static bundle; the replacement must be server-side in Step 4.

Delete or update tests/styles that existed only for the client-side password
form.

**Verify**:

- `rg -n "VITE_CONSOLE_PASSWORD|SESSION_KEY|athena.console.authenticated|Console Access|Incorrect password" apps/console/src` returns no production-code matches.
- `npm --workspace @athena/console run typecheck` exits 0.
- `npm --workspace @athena/console run test` exits 0.

### Step 3: Stop passing secrets as build arguments

In both compose files, remove `VITE_ATHENA_API_TOKEN`, `VITE_ATHENA_IDENTITY`,
and `VITE_CONSOLE_PASSWORD` from `console.build.args`.

In `packages/core/infrastructure/docker/console.prod.Dockerfile`, remove the
secret `ARG` and `ENV` declarations before `npm run build`. The Vite build must
not receive API credentials or console passwords.

**Verify**:

- `rg -n "VITE_ATHENA_API_TOKEN|VITE_ATHENA_IDENTITY|VITE_CONSOLE_PASSWORD" docker-compose*.yml packages/core/infrastructure/docker/console.prod.Dockerfile` returns no matches.
- `npm --workspace @athena/console run build` exits 0.

### Step 4: Add server-side console auth and proxy credential injection

Keep the API token on the server side only. Implement the production console
container so Nginx:

- protects both `/` and `/api/` with server-side basic auth using
  `ATHENA_CONSOLE_PASSWORD`;
- proxies `/api/` to `http://api:8787/api/`;
- injects `Authorization: Bearer $ATHENA_AUTH_API_TOKEN` and
  `x-athena-identity: console` when proxying to the API;
- strips any browser-supplied `Authorization`, `x-athena-identity`, or
  `x-athena-api-token` before setting the server-controlled values.

One acceptable implementation:

- Install `apache2-utils` in the `nginx:1.27-alpine` runtime image so `htpasswd`
  is available.
- Add a small entrypoint script under
  `packages/core/infrastructure/docker/console-entrypoint.sh` that:
  - fails fast if `ATHENA_AUTH_API_TOKEN` or `ATHENA_CONSOLE_PASSWORD` is empty;
  - creates `/etc/nginx/athena.htpasswd` for a fixed username such as `operator`;
  - renders an Nginx config from a template without writing the raw password to
    disk.
- Configure the compose `console.environment` with
  `ATHENA_AUTH_API_TOKEN` and `ATHENA_CONSOLE_PASSWORD`.

Do not use Vite env vars for this. The API token may exist in the running
container environment and generated Nginx config, but never in `/usr/share/nginx/html`.

**Verify**:

- `docker compose -f docker-compose.server.yml config >/tmp/athena-server-compose.yml` exits 0.
- `docker compose -f docker-compose.prod.yml config >/tmp/athena-prod-compose.yml` exits 0.
- `rg -n "proxy_set_header Authorization|proxy_set_header x-athena-identity|auth_basic" packages/core/infrastructure/docker` shows the server-side Nginx config/template contains these controls.

### Step 5: Prove the built assets are credential-free

Build the console and inspect generated assets for removed variable names and
secret-bearing headers.

**Verify**:

- `npm --workspace @athena/console run build` exits 0.
- `rg -n "VITE_ATHENA_API_TOKEN|VITE_ATHENA_IDENTITY|VITE_CONSOLE_PASSWORD|x-athena-identity|Bearer" apps/console/dist` returns no matches.
- `git diff --check` exits 0.

## Test plan

- Add or update console tests around `ApiClient` request headers. The regression
  case is: a normal console request must not include `Authorization` or
  `x-athena-identity` from browser code.
- Existing console typecheck/tests/build must pass.
- Compose config rendering must pass for both trusted-server profiles.

## Done criteria

- [ ] No Vite env var carries the API token, trusted identity, or console
  password.
- [ ] Browser-built assets contain no API bearer token path, no static trusted
  identity, and no console password gate.
- [ ] Console access is enforced server-side before static assets or proxied API
  calls are served.
- [ ] Proxied API calls receive server-controlled auth headers.
- [ ] Console typecheck, tests, build, compose config checks, and
  `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The desired deployment requires unauthenticated static console access.
- Nginx cannot generate or consume a server-side password file without exposing
  the raw password in browser-readable output.
- Fixing this requires changing API RBAC behavior outside the console proxy
  boundary.
- Any built asset still contains `VITE_ATHENA_API_TOKEN`,
  `VITE_ATHENA_IDENTITY`, `VITE_CONSOLE_PASSWORD`, `x-athena-identity`, or
  `Bearer`.

## Maintenance notes

Reviewers should inspect the built `apps/console/dist` output, not just source
code. Future console auth changes must treat Vite variables as public browser
configuration, never as secrets.
