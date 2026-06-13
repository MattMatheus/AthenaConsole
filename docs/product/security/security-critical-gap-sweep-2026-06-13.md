# Security-Critical Gap Sweep

Date: 2026-06-13

## Must Fix Before Multi-User Alpha

- Child-process env fallback to full host env: fixed by removing the `command.env ?? process.env` spawn path. Local-command execution now depends on the precomputed allowlisted environment plus run sidecar variables.
- Trusted-header readiness warning: fixed with `ATHENA_AUTH_TRUSTED_PROXY_CONFIGURED`. Readiness warns when auth is enabled but a header-stripping proxy has not been declared.
- Shared secret resolver: added for model provider secret reads. Runtime/test reads emit `secret.read` audit events containing reference, purpose, subject, and resource id without secret values.

## Verified Protections

- Local-command env allowlist excludes `ATHENA_AUTH_API_TOKEN`, `OPENAI_API_KEY`, and `ATHENA_OPENAI_API_KEY` in existing task-workbench coverage.
- Provider config APIs redact secret values and return only secret metadata.
- RBAC authorizer protects provider configuration, policy updates, durable-memory approval operations, and task execution with role checks.
- Runtime log/output redaction replaces known runtime provider secrets before persistence.

## Can Follow

- Expand governance audit search/export categories beyond current policy/RBAC plus event-stream secret-read records (`ENTERPRISE-004`).
- Add connector write audit events as concrete connectors ship (`CONNECTOR-003`).
- Add workspace-scoped RBAC after the default workspace migration (`ENTERPRISE-007`).
