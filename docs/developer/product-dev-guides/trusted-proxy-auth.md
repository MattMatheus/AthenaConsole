# Trusted Proxy Auth Recipes

Team Orchestrator treats `x-athena-identity` as a trusted service header. Never let browsers or external clients set that header directly.

## Required Proxy Behavior

- Strip inbound `x-athena-identity` from every client request.
- Authenticate the user with the proxy or access gateway.
- Inject exactly one identity header after authentication.
- Forward `Authorization: Bearer <ATHENA_AUTH_API_TOKEN>` to the API or keep the API token in the proxy layer.
- Set `ATHENA_AUTH_TRUSTED_PROXY_CONFIGURED=true` only after the strip/inject rule is deployed.
- Keep `ATHENA_AUTHZ_MODE=enforce` for multi-user deployments.

## Cloudflare Access

1. Put the console/API behind Cloudflare Access.
2. Configure Access to require your identity provider group.
3. In the origin request transform, remove inbound `x-athena-identity`.
4. Inject `x-athena-identity` from the authenticated email claim.
5. Keep the API origin private to Cloudflare tunnel or a firewall allowlist.

## Authentik Or Keycloak Via nginx

1. Put nginx in front of the API and require `auth_request` or OIDC authentication.
2. Clear client-supplied identity headers:

```nginx
proxy_set_header x-athena-identity "";
```

3. Inject the authenticated subject from the proxy auth result:

```nginx
proxy_set_header x-athena-identity $authentik_email;
```

4. Forward only to the private API upstream and keep direct API access blocked.

## Validation

- `curl -H 'x-athena-identity: admin'` through the public endpoint must not become Admin unless the authenticated proxy subject is Admin.
- `/api/v1/readiness` should not show `trusted-proxy-auth` degraded after `ATHENA_AUTH_TRUSTED_PROXY_CONFIGURED=true`.
- Audit events should show the injected identity, not arbitrary client-provided header values.
