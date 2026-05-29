<!-- AUDIENCE: Internal/Technical -->

# ADR 0018: Real Work Enablement Operating Model

## Status

Accepted.

## Context

Team Orchestrator now has a coherent first-run path, a clearer console, and repo-wiring guidance. The next roadmap arc needs to let operators do useful work:

- connect or clone a repository without hand-editing environment variables,
- configure an AI model provider without leaking API keys,
- build or install plugin-backed agents for generic work,
- run tasks/workflows with structured inputs and safety gates,
- deploy the stack on a local server with durable storage.

ADR 0017 intentionally deferred first-class repository persistence while the product focused on operator clarity. The Real Work Enablement arc crosses the threshold where saved repository records, provider readiness, and server path ownership become product concepts.

## Decision

Promote real-work setup into explicit local-first resources while preserving the manifest-backed agent model.

Team Orchestrator will introduce four related operator resources:

1. Connected repositories.
2. Model provider configurations.
3. Secret references.
4. Real-work run contexts.

SQLite owns resource metadata, readiness status, and references. The filesystem owns repository working trees, plugin source packages, large artifacts, and local secret material. Raw secret values are never stored in ordinary app-state rows, run events, logs, artifacts, or browser-visible diagnostics.

Agents remain plugin/manifest-backed. The console may help operators load, inspect, test, and document agents, but it must not become the normal authoring surface for agents. Agent creation belongs in an SDK/template/plugin workflow.

## Connected Repositories

Connected repositories become first-class app-state resources.

A repository record should include:

- `id`
- display `name`
- `sourceType`: `managed-clone` or `existing-path`
- optional `remoteUrl`
- `workspacePath`: the path used by the API/runtime container or local process
- optional `hostPath`: the host-visible path when it differs from container path
- `defaultBranch`
- inspected `currentBranch`
- inspected `headCommit`
- inspected `dirtyState`
- `status`: `ready`, `missing`, `invalid`, `auth-required`, or `error`
- timestamps for creation, update, and last inspection

Managed clones live under an app-managed repo root, for example:

- `${ATHENA_WORKSPACE_ROOT}/repos/managed/<repo-id>`

Existing-path repos point to a mounted or local path the operator already controls.

Clone support should start narrow:

- public HTTPS clone,
- local filesystem clone/path,
- no hosted Git OAuth in the first pass,
- no automatic push,
- no remote mutation without an explicit future approval flow.

Private Git auth may be added later through credential references, not raw credentials embedded in repository records.

Task and workflow inputs should carry a stable repo context object rather than ad hoc strings where possible:

```json
{
  "repo": {
    "id": "repo-docs",
    "workspacePath": "/workspace/repos/managed/repo-docs",
    "branch": "main"
  }
}
```

Agents may still accept legacy/plain `repoPath` inputs during the transition, but new SDK examples and templates should use the structured `repo` context.

## Model Providers And Secrets

Provider setup becomes an operator-facing settings resource.

A provider configuration should include:

- `id`
- `type`: `mock`, `openai-compatible`, `http`, `foundry`, or later provider types
- display `name`
- `baseUrl` or endpoint metadata where needed
- default `model`
- optional fallback order
- `secretRef` rather than a raw API key
- readiness/test status

Secret references identify where secret material lives without exposing it. Supported secret reference kinds should start with:

- `env`: existing environment variable owned by deployment config,
- `local-file`: local secret file under the workspace/state secret root with restrictive permissions,
- later `external`: key vault or server-managed secret provider.

SQLite may store the secret reference and metadata, but not the raw value. APIs must redact secret fields consistently. Events, logs, artifacts, readiness payloads, and browser responses must show only values such as `configured`, `missing`, `redacted`, or the reference name.

OpenAI-compatible API-key setup is the first practical target because it also covers many local model gateways. Foundry/Azure support can map onto the same provider metadata when the current environment-based paths remain useful.

Codex subscription reuse is not a committed integration. It requires a research note and should only be implemented through a supported API or documented local integration path. The product must not scrape or reuse consumer app sessions.

## Agent SDK And Examples

The SDK should make plugin-backed agents easier to build without making manifests optional.

The manifest remains the installation, discovery, compatibility, and UI contract. The SDK may:

- define typed input schemas,
- generate or validate manifest fragments,
- parse the task/run envelope from stdin or HTTP,
- emit the standard agent run envelope,
- write artifact metadata helpers,
- provide mocked provider/test helpers,
- expose a provider client only through Team Orchestrator-controlled provider references or a provider proxy.

The SDK should not receive raw API keys by default. Model-backed agents should declare provider requirements and use the runtime/provider path selected by Team Orchestrator wherever practical.

Initial examples should prove common generic work:

- article/content summarization,
- shopping or web research planning,
- repository/codebase summarization.

Examples must be read-only by default. Anything that writes to a repo, purchases, submits forms, pushes, or calls external services beyond the configured model provider must require explicit permissions and a future approval path.

## Real-Work Run Loop

Task and workflow creation should move from raw JSON toward structured forms.

Agent and workflow manifests should expose enough input metadata for the console to render:

- repo selector,
- objective text,
- provider/model selector,
- file/path scope,
- output preferences,
- run mode.

Run modes should start with:

- `read-only`: inspect and produce artifacts only,
- `propose-changes`: create patch/diff artifacts but do not apply them,
- `approved-write`: apply changes only after an explicit approval record.

The default mode is `read-only`.

Readiness checks should run before task/workflow start and report missing:

- repo context,
- provider/secret,
- plugin/agent,
- runtime backend,
- required permissions.

For repo mutations, the product should prefer proposal artifacts first:

- unified diff,
- changed-file list,
- rationale,
- test/validation suggestion,
- apply/commit approval status.

No remote push should happen in this roadmap arc unless a later ADR explicitly defines push approvals and credential handling.

## Local Server Deployment

The local-server target is a durable LAN deployment, not an internet-hosted SaaS profile.

Server deployment should make these storage boundaries explicit:

- workspace/app-state volume,
- artifact payload volume,
- managed repo volume,
- plugin package volume,
- secret material volume,
- optional backup/export location.

The server profile should default to LAN-safe behavior:

- no public exposure by default,
- auth enabled or clearly warned when exposed beyond loopback/LAN,
- explicit ports,
- explicit volume paths,
- no raw secrets in compose files beyond local development examples.

Readiness diagnostics should report:

- app-state database availability,
- artifact storage availability,
- managed repo root availability,
- plugin search path status,
- provider configuration status without revealing secrets,
- runtime backend availability,
- server deployment warnings.

## Implementation Sequence

Recommended sequence for epics 2026.26 through 2026.30:

1. Add repository connection app-state, inspection service, and console flow.
2. Add provider metadata, secret references, redaction, and provider setup/test flow.
3. Add SDK package and useful example plugins using structured repo/provider inputs.
4. Upgrade create-work flows to render structured inputs, readiness checks, and safe run modes.
5. Add local-server compose/profile, persistent volumes, readiness diagnostics, and a fresh-server walkthrough.

This sequence gets the system to "do useful work" before making server deployment the final proof.

## Alternatives Considered

Continue with environment-only repository wiring.

- Rejected for this arc because operators already found environment variables confusing, and real work needs a durable repo selector.

Make the console author agents directly.

- Rejected because it conflicts with the manifest/plugin architecture and would create a large product surface before the SDK path exists.

Store provider API keys directly in SQLite.

- Rejected because app-state is queryable product metadata and should not become the raw secret store.

Start with local-server deployment before repo/model/agent work.

- Rejected because deployment should prove a useful operator loop, not merely move the current demo to another host.

## Consequences

The product gains new durable resources for repositories and provider setup. This adds persistence and migration work, but it removes the most confusing operator setup steps.

The SDK becomes the developer path for custom agents while the console remains the operator path for running and inspecting work.

The run loop can become safer and more understandable because repo context, provider readiness, and write permissions are explicit before execution.

Local-server deployment has a clearer target: a durable LAN service capable of running real work against connected repos with configured providers.

## Risks

- Host/container path translation can confuse repository setup unless the UI shows both paths when they differ.
- Secret handling can regress if APIs accidentally serialize raw values.
- SDK abstractions can harden too early; keep manifests canonical and helper APIs small.
- Model/provider readiness can look complete before agents actually use provider context; example agents must validate the full path.
- Repo mutation approval needs careful implementation before any write-capable agent is promoted.
