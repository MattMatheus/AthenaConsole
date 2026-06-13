# GitHub Connector Pack

This bundled pack is the first service-specific connector pack for Team Orchestrator. It uses the connector platform to declare GitHub service metadata, read scopes, rate limits, optional write scopes, and approval-gated external-write operations.

Current behavior is deterministic and fixture-backed:

- No live GitHub API calls are made during validation.
- Read-only workflows require read scopes only.
- Issue triage, PR summary, PR review support, release notes, and repo onboarding outputs are inspectable artifacts.
- Suggested comments, labels, and release notes are drafts unless an approved write path is explicitly exercised.
- Optional write operations remain external writes and require approval evidence.

## Capability Matrix

| Capability | Entry point | Mode | Fixture | Expected artifact | Readiness behavior |
| --- | --- | --- | --- | --- | --- |
| Repository context | `bundled.github.repo-context.local` / `bundled.github.repo-onboarding.workflow` | Deterministic connector fixture | `fixtures/read-connector.inputs.json` | `github_repo_context` markdown | Requires connector account metadata and read scopes for live mode; fixture mode makes no network calls. |
| Issue triage | `bundled.github.issue.triage.local` / `bundled.github.issue-triage-round.workflow` | Deterministic connector fixture | `fixtures/issue-triage-round.inputs.json` | `issue_triage` markdown | Missing credentials/scopes should block live connector runs; fixture runs remain local. |
| PR brief | `bundled.github.pr.summarize.local`, `bundled.github.pr.review-support.local`, `bundled.github.pr-review-brief.workflow` | Deterministic connector fixture | `fixtures/pr-review-brief.inputs.json` | `pr_summary`, `pr_review_support` markdown | Uses read-only PR/commit scopes; no comments are posted. |
| Release prep | `bundled.github.release.notes-draft.local` / `bundled.github.release-prep.workflow` | Deterministic connector fixture | `fixtures/release-prep.inputs.json` | `release_notes_draft` markdown | Draft-only output; release publishing remains approval-gated. |
| Approved write fixture | `bundled.github.approved-write.local` | Deterministic approval fixture | `fixtures/approved-write.inputs.json` | `approved_write` markdown | External write stays blocked without approval evidence and never publishes in fixture mode. |

Recommended credential posture for the first implementation is a fine-grained PAT or GitHub App token reference with repository read scopes. Store only credential references in Team Orchestrator; never place token values in manifests, task inputs, runs, artifacts, or fixtures.

Live smoke testing, when added later, should use a dedicated test repository and explicit operator approval for any write behavior.
