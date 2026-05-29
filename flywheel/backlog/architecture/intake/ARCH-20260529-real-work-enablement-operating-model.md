---
kind: architecture
id: ARCH-20260529-real-work-enablement-operating-model
status: intake
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
- `status`: intake
- `source`: roadmap
- `decision_refs`: [ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0017]
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

## Transition History
- `2026-05-29T02:54:09Z`: planning intake created for real work enablement operating model
