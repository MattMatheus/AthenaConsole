<!-- AUDIENCE: Internal/Technical -->

# Future Horizon Roadmap

This roadmap captures post-`2026.1` product direction for Team Orchestrator.

The first release candidate should remain focused on the current local-first product baseline. After that release is cut, the next product investment should increase the product's built-in usefulness without turning the console into an unbounded feature pile.

## Product Thesis

Team Orchestrator should combine:

- local execution where the operator can inspect what agents do,
- remote continuity where durable memory and account/workspace state travel across machines,
- first-party capability packs that make the product useful immediately,
- connector packs that show how external services can be integrated safely,
- workflow templates that compose agents into repeatable higher-order flows.

## Arc 1: Durable Memory System

Memory should be a first-class Team Orchestrator service, not just a local SQLite file or debug search endpoint.

Product principle:

- **Local execution, remote continuity.**

Agents may run on a laptop, local server, or remote host, but durable memory should be scoped to the operator, workspace, project, repository, and team in a way that can travel across those environments.

### 2026.34 Durable Memory Service Architecture

Source epic:

- `docs/product/epics/refinement/2026.34.00-epic-durable-memory-service-architecture.md`

Outcome:

- Define the canonical memory domain, provider contract, namespace model, auth assumptions, provenance requirements, and local-cache boundary.

### 2026.35 Remote Memory MVP

Source epic:

- `docs/product/epics/refinement/2026.35.00-epic-remote-memory-mvp.md`

Outcome:

- Ship a remote-capable memory service path with write, read, search, list, archive/delete, and snapshot primitives. Local SQLite remains useful for development, tests, and cache behavior, but is not the product source of truth for durable memory.

### 2026.36 Memory Governance And Agent Integration

Source epic:

- `docs/product/epics/refinement/2026.36.00-epic-memory-governance-agent-integration.md`

Outcome:

- Let agents read, propose, and write memory through explicit permissions, operator review, run provenance, and inspectable audit trails.

### 2026.37 Semantic Memory And Sync Backends

Source epic:

- `docs/product/epics/refinement/2026.37.00-epic-semantic-memory-and-sync-backends.md`

Outcome:

- Add semantic retrieval and optional backend adapters such as Chroma or an AthenaMemory-compatible service behind the Team Orchestrator memory contract.

## Arc 2: Built-In Capability And Connector Packs

First-party agents and workflows should make the product feel immediately capable while serving as canonical examples for agent authors.

Product principle:

- **Useful out of the box, extensible by example.**

Built-in packs should be ordinary plugins that use the same manifest, runtime, safety, provider, memory, artifact, and workflow systems available to user-authored plugins.

### 2026.38 Capability Pack Foundation

Source epic:

- `docs/product/epics/refinement/2026.38.00-epic-capability-pack-foundation.md`

Outcome:

- Define first-party pack conventions, pack metadata, bundled installation behavior, documentation patterns, fixture/testing requirements, and workflow composition rules.

### 2026.39 Built-In Software Team Agent Pack

Source epic:

- `docs/product/epics/refinement/2026.39.00-epic-built-in-software-team-agent-pack.md`

Outcome:

- Ship useful no-auth and provider-backed software-work agents: repo summarizer, code reviewer, changelog/release-note drafter, docs auditor, test failure explainer, and release readiness reviewer.

### 2026.40 Connector Pack Platform

Source epic:

- `docs/product/epics/refinement/2026.40.00-epic-connector-pack-platform.md`

Outcome:

- Add the connector primitives needed before service-specific packs: auth binding, scopes, rate limits, safe external writes, mock fixtures, and connector diagnostics.

### 2026.41 GitHub Connector Pack

Source epic:

- `docs/product/epics/refinement/2026.41.00-epic-github-connector-pack.md`

Outcome:

- Provide first-party GitHub agents and workflows for issue triage, PR summarization, PR review support, release-note drafting, and repository onboarding.

### 2026.42 Knowledge Work Connector Pack

Source epic:

- `docs/product/epics/refinement/2026.42.00-epic-knowledge-work-connector-pack.md`

Outcome:

- Provide first-party connectors and agents for knowledge-work surfaces such as Notion, Google Drive/Docs, Slack, Linear/Jira, or local document stores, selected by implementation readiness and safety posture.

## Sequencing Guidance

Recommended sequence:

1. Cut `2026.1` without adding new product surface.
2. Refine and accept 2026.34 before implementing any durable memory work.
3. Build 2026.35 remote memory MVP before memory-aware built-in agents depend on it.
4. Start 2026.38 capability pack foundation in parallel with memory architecture if release bandwidth allows.
5. Ship 2026.39 before service connectors so new users get value without third-party credentials.
6. Build 2026.40 before GitHub or knowledge-work connector packs.
7. Use 2026.41 as the first service-specific connector proving ground.
8. Let 2026.42 select its first service by user value, auth complexity, and safety risk.

## Non-Goals

- Do not make SQLite the durable product memory source of truth across machines.
- Do not require users to copy DB files between laptop, local server, and remote server.
- Do not bypass the plugin model for first-party agents.
- Do not add connector write actions without explicit permission, scope, audit, and approval design.
- Do not make natural-language autonomous planning the default path for these arcs.

## Open Planning Questions

- Should the remote memory MVP be hosted as a separate service, a server mode in this repo, or an adapter to an existing AthenaMemory service?
- Which identity model should memory use first: single-user token, workspace token, or account/workspace split?
- What is the first remote storage backend: Postgres, object storage plus index, Chroma server, AthenaMemory, or another service?
- Should first-party capability packs ship enabled by default, suggested during onboarding, or installed from a local bundled catalog?
- Which connector should follow GitHub if only one knowledge-work service can be built first?
