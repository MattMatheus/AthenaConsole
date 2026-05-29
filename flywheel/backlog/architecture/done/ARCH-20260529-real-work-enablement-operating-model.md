---
kind: architecture
id: ARCH-20260529-real-work-enablement-operating-model
status: done
owner_role: Architect
source: roadmap
success_metric: The next roadmap arc has a coherent operating model for repo connection, model providers, agent SDKs, run safety, and local-server deployment.
release_scope: next
ready: false
---

# Architecture: Real Work Enablement Operating Model

## Metadata
- `id`: ARCH-20260529-real-work-enablement-operating-model
- `owner_role`: Architect
- `status`: done
- `source`: roadmap
- `decision_refs`: [ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0017, ADR-0018]
- `epics`:
  - docs/product/epics/refinement/2026.26.00-epic-real-work-repo-connection.md
  - docs/product/epics/refinement/2026.27.00-epic-model-provider-and-secrets-setup.md
  - docs/product/epics/refinement/2026.28.00-epic-agent-sdk-and-examples.md
  - docs/product/epics/refinement/2026.29.00-epic-real-work-run-loop.md
  - docs/product/epics/refinement/2026.30.00-epic-local-server-deployment-readiness.md
- `success_metric`: The next roadmap arc has a coherent operating model for repo connection, model providers, agent SDKs, run safety, and local-server deployment.
- `release_scope`: next

## Problem Statement

Team Orchestrator is understandable now, but the next roadmap arc needs to let operators do real work. Before implementation starts, the product needs a coherent model for connected repositories, model provider configuration and secrets, plugin/agent SDK boundaries, safe run execution, and local-server deployment.

## Initial Scope

- In: repo clone/select model, provider/secret ownership, SDK boundaries, example agent expectations, structured run inputs, repo mutation safety, local-server storage/deployment topology, sequencing guidance.
- Out: hosted SaaS, public internet deployment, Git provider OAuth, plugin marketplace, console-native agent authoring, unsupported subscription/session reuse.

## Draft Acceptance Criteria

1. Defines how connected repos are represented, inspected, and passed into tasks/workflows.
2. Defines provider configuration, secret storage, redaction, and test-connection expectations.
3. Defines the first agent SDK/example boundaries and how they preserve manifest-backed agents.
4. Defines structured run input, readiness, and approval/safety expectations for real work.
5. Defines local-server deployment storage, path, secret, and readiness expectations.
6. Produces a recommended implementation sequence across epics 2026.26 through 2026.30.

## Validation

- Architecture review against ADR-0006 through ADR-0013 and ADR-0017.
- Confirm implementation guidance does not imply console-native agent authoring, remote push automation, public deployment, or unsupported Codex subscription integration.
- `./flywheel/tools/validate_workflow_state.sh`

## Refinement Notes

Planning intake created from operator feedback after first-run, console polish, repo-wiring guidance, and roadmap true-up. This should be the first architecture item before the next engineering story sequence is refined.

## Architecture Handoff
- `decision_summary`: ADR-0018 promotes real-work setup into explicit local-first resources: connected repositories, model provider configurations, secret references, and structured run contexts. Repositories become first-class app-state metadata with filesystem-owned working trees. Provider settings store metadata and secret references, while raw secrets stay out of SQLite, events, logs, artifacts, and browser diagnostics. Agents remain plugin/manifest-backed, with SDK/examples as the authoring path rather than console-native agent creation.
- `implementation_guidance`: Start with repo connection app-state, inspection, and console flows; then add provider metadata, secret references, redaction, and test-connection flows; then add an SDK/example agent package; then improve create-work forms with structured inputs/readiness/safe run modes; finally add the local-server compose profile, persistent volumes, and deployment diagnostics. Use structured `repo` context for new tasks/workflows while tolerating plain `repoPath` during transition.
- `validation_guidance`: Add core tests for repo metadata/inspection, provider redaction, secret reference resolution, SDK envelope helpers, structured input validation, and readiness checks. Browser-QA repo/provider/create-work/server readiness flows at desktop and mobile widths. Smoke the end-to-end path with a connected repo, configured provider or mock, loaded example agent, and completed run.
- `open_risks`: Host/container path translation can confuse repo setup; secret values can leak if serialization is careless; SDK helpers may harden before manifest needs settle; provider readiness may look complete before example agents prove the full path; repo mutation approvals need careful design before write-capable agents are promoted.
- `alternatives_considered`: Continued environment-only repo wiring, console-native agent authoring, storing raw API keys in SQLite, and starting with server deployment before real-work loops were rejected for this arc.
- `operational_impact`: Operators get durable repo/provider setup surfaces and can move toward real work without hand-editing env vars. Local-server deployment becomes a durable LAN service target with explicit volumes for workspace state, artifacts, repos, plugins, and secrets.
- `follow_on_work`: PM refinement should break epics 2026.26 through 2026.30 into sequential architecture/engineering stories, beginning with repo connection and provider/secret setup before SDK/examples and server deployment.

## QA Verdict
- `verdict`: Pass. ADR-0018 satisfies the six acceptance criteria and gives the next roadmap arc a coherent implementation sequence across repo connection, provider/secrets, SDK/examples, run safety, and local-server deployment.
- `evidence_quality`: Strong. QA reviewed ADR-0018 against ADR-0007, ADR-0008, ADR-0010, ADR-0013, ADR-0017, current provider config/registry behavior, current task input/runtime behavior, and Flywheel validation.
- `defects`: None found.
- `state_transition`: Move to done.

## Transition History
- `2026-05-29T02:54:09Z`: planning intake created for real work enablement operating model
- `2026-05-29T03:01:17Z`: `intake` -> `active`; Architecture starts real work enablement operating model
- `2026-05-29T03:02:53Z`: architecture handoff completed with ADR-0018
- `2026-05-29T03:04:08Z`: `active` -> `qa`; Architecture handoff ready for QA
- `2026-05-29T03:04:13Z`: QA passed with no defects
- `2026-05-29T03:04:54Z`: `qa` -> `done`; QA passed for real work enablement operating model
