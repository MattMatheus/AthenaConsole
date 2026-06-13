<!-- AUDIENCE: Internal/Technical -->

# AthenaAgent Workbench Pilot Package

This package describes the pilot-ready workbench path for Team Orchestrator plus AthenaAgent. It is meant for an engineer or operator who needs to understand, demo, or extend the system without reading source code first.

## Pilot Scope

Pilot-ready:

- Local or trusted-LAN Console/API deployment with token auth and trusted identity headers.
- Built-in deterministic software-team agents that run without provider credentials.
- Model-backed `athena-agent.*` software-team agents for repository summary, PR/diff review, and test failure triage.
- Inspectable run events, sidecar AthenaAgent events, redacted provider secrets, and markdown artifact previews.
- Durable-memory proposal/review and pre-run approved memory-context injection.
- Manifest-backed agent authoring using the existing Team Orchestrator plugin model.

Future investment:

- Internet-facing auth, multi-user identity provider integration, and per-user tokens.
- Direct durable-memory MCP tooling for live in-run reads and writes.
- Cloud deployment automation, registry publishing, and Kubernetes rollout.
- Rich semantic memory retrieval beyond the local/server-mode pilot path.
- Write-capable software-team agents with file mutation approvals.

## Quickstart

Use the checked-in local server path when proving the full pilot:

1. Clone `AthenaConsole` and sibling `AthenaAgent` under the same parent directory.
2. Follow [Fresh Server Real-Work Walkthrough](../../developer/product-dev-guides/fresh-server-real-work-walkthrough.md).
3. Configure a model provider in Settings using a local-file secret under `/run/secrets/athena`.
4. Confirm `athena-agent.repo-summary`, `athena-agent.pr-diff-review`, and `athena-agent.test-failure-triage` appear in the agent catalog.
5. Run `npm run smoke:product -- --api-base-url http://127.0.0.1:8787 --api-token "$ATHENA_AUTH_API_TOKEN" --identity console`.

The server image packages AthenaAgent from the sibling build context. Verify it inside the API container:

```bash
docker compose --env-file server.env -f docker-compose.server.yml exec api \
  /opt/athena-agent-venv/bin/python -c "import athena_agent.console_runner; print('athena-agent-runtime-ok')"
```

## Demo Script

1. Open the console and confirm readiness separates first-run demo, provider setup, real-work, and server-hardening lanes.
2. Run the credential-free first-run demo and inspect its workflow status and task artifact.
3. Connect or select a ready repository.
4. Run `athena-agent.repo-summary` against the repository.
5. Open the task run detail and inspect:
   - `run.started`, `model.request`, `tool.started`, `tool.completed`, `artifact.created`, and `run.completed` events.
   - The markdown artifact preview.
   - Redacted provider details in logs and run payloads.
6. Run a second workflow, such as `bundled.software-team.repo-onboarding.workflow`, using `memoryContextRequest` when approved memory exists.
7. Run an AthenaAgent task with an explicit `memoryProposal` input, then open durable-memory proposal review.
8. Approve the proposal and confirm a durable-memory record is created.
9. Restart the stack and reopen the prior task run to show run history and artifacts persist.
10. Open [Software Team Pack](../../../bundled-plugins/software-team/docs/README.md) and [Capability Pack Authoring](../../developer/product-dev-guides/capability-pack-authoring.md) to show the authoring path.

## Dogfood Matrix

| Area | Proof | Expected result |
| --- | --- | --- |
| Startup | `docker compose --env-file server.env -f docker-compose.server.yml up --build -d` | API and console become healthy. |
| Packaged AthenaAgent | API-container import check | `athena-agent-runtime-ok`. |
| Provider readiness | Agent catalog before provider setup | `athena-agent.*` agents present but provider-blocked. |
| Model-backed run | Repository summary task | Completed run with markdown artifact and sidecar events. |
| Event inspection | Run detail | Lifecycle, model, tool, artifact, and failure events are inspectable. |
| Artifact preview | Open markdown artifact | Text preview renders without leaking provider secrets. |
| Security posture | Viewer, Operator, Admin identities | Provider config is Admin-only; task execution is Operator/Admin; read inspection is Viewer-capable. |
| Memory proposal | Task with `memoryProposal` | Proposal appears for operator review with evidence. |
| Memory approval | Approve proposal | Durable-memory record is created with task-run provenance. |
| Memory read path | Workflow/task with `memoryContextRequest` | Approved snippets are injected as `memoryContext` before run start. |
| Restart durability | Restart API/console | Prior run, events, and artifacts remain available. |
| Authoring path | Add a manifest-backed local-command agent | Pack validates and appears in catalog. |

## Reliability Sweep

Run before calling a pilot build ready:

```bash
npm --workspace @athena/core run typecheck
npm --workspace @athena/core run check:schemas
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core run validate:pack-fixtures
npm --workspace @athena/core run test:unit -- \
  tests/control-plane.authorization.test.ts \
  tests/api.auth-middleware.test.ts \
  tests/server-deployment-athena-agent.test.ts \
  tests/control-plane.athena-agent-repo-summary.test.ts \
  tests/control-plane.task-workbench.test.ts \
  tests/bundled-software-team-runner.test.ts \
  tests/durable-memory.server-storage.test.ts
```

In `../AthenaAgent`:

```bash
.venv/bin/pytest tests/test_console_runner.py tests/test_console_runtime_config.py tests/test_console_events.py
```

Docker is required for compose validation and real server smoke. If Docker is unavailable, record that limitation and run the static deployment tests.

## Security Assumptions

- This is a trusted local or trusted-LAN pilot, not an internet-facing deployment.
- `x-athena-identity` is a trusted proxy/service header after bearer-token auth. A reverse proxy must strip inbound client identity headers and inject only authenticated identities.
- The default server profile represents `console:Admin`, `operator:Operator`, `healthcheck:Viewer`, and `*:Viewer`.
- Provider secrets should use local-file references under `/run/secrets/athena`; logs, run output, events, and artifacts must redact provider API keys.
- Model-backed agents use read-only/propose-oriented guardrails. They do not modify repository files.

## Operator Guide

- Use deterministic `bundled.software-team.*.local` agents when proving the stack without model credentials.
- Use `athena-agent.*` agents when provider-backed reasoning is needed.
- Treat degraded provider readiness as expected until a provider is configured.
- Use `memoryProposal` only for stable reusable guidance, never secrets or one-off findings.
- Use `memoryContextRequest` to inject approved snippets into a run. Runtime search/get events are audit-only for the issuing run.

## Agent Authoring Guide

Author pilot agents as normal `*.agent.yaml` manifests:

- Declare capabilities, inputs, outputs, runtime, permissions, limits, and observability.
- Use `runtime.modelProvider.required: true` for AthenaAgent-powered model agents.
- Use `observability.strictResultEnvelope: true` for bridge agents.
- Declare durable-memory `read` or `propose` namespaces before requesting memory context or proposals.
- Keep deterministic agents provider-free so pack validation remains available without credentials.

See [Capability Pack Authoring](../../developer/product-dev-guides/capability-pack-authoring.md) and [ADR 0026](../architecture/decisions/0026-formal-agent-manifest-convention.md).

## Known Limitations

- Provider-backed runs require network egress from the API container to the configured model provider.
- Durable-memory context injection is pre-run only. There is no in-run memory MCP tool in the pilot.
- Identity headers are trusted assertions, not end-user authentication.
- Compose build expects `../AthenaAgent` beside `AthenaConsole`.
- The software-team pack is read-only/propose-only; write workflows need a later approval model.

## Next Phase

- Add direct durable-memory MCP tools after pilot feedback.
- Introduce stronger identity and token models for multi-user or internet-facing deployments.
- Expand model-backed capability packs beyond software-team tasks.
- Add richer semantic memory provider operations and remote-memory hardening.
- Define write approval flows for patch-producing agents.
