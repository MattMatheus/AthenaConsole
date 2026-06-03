# GitHub Connector Pack

This bundled pack is the first service-specific connector pack for Team Orchestrator. It uses the connector platform to declare GitHub service metadata, read scopes, rate limits, optional write scopes, and approval-gated external-write operations.

Current behavior is deterministic and fixture-backed:

- No live GitHub API calls are made during validation.
- Read-only workflows require read scopes only.
- Issue triage, PR summary, PR review support, release notes, and repo onboarding outputs are inspectable artifacts.
- Suggested comments, labels, and release notes are drafts unless an approved write path is explicitly exercised.
- Optional write operations remain external writes and require approval evidence.

Recommended credential posture for the first implementation is a fine-grained PAT or GitHub App token reference with repository read scopes. Store only credential references in Team Orchestrator; never place token values in manifests, task inputs, runs, artifacts, or fixtures.

Live smoke testing, when added later, should use a dedicated test repository and explicit operator approval for any write behavior.
