---
kind: bug
id: BUG-20260528-glob10-deprecation-warning
status: intake
priority: P2
reported_by: QA Engineer
source_story: direct
impact_metric: CI dependency install logs no longer emit the deprecated glob@10.5.0 warning.
ready: false
---

# BUG-2026.002: CI emits deprecated `glob@10.5.0` security warning

## Metadata
- `id`: BUG-20260528-glob10-deprecation-warning
- `priority`: P2
- `reported_by`: QA Engineer
- `source_story`: direct
- `status`: intake
- `decision_refs`: []
- `impact_metric`: CI dependency install logs no longer emit the deprecated glob@10.5.0 warning.

## Summary

CI logs include a deprecation/security warning for `glob@10.5.0`:

- `npm warn deprecated glob@10.5.0: Old versions of glob are not supported... contain widely publicized security vulnerabilities...`

This should be investigated and remediated so dependency hygiene and compliance posture are explicit.

## Impact

- Security/compliance noise in CI pipelines.
- Potential unresolved transitive dependency risk if vulnerable paths are reachable.
- Audit signal quality degrades when known warnings are left unresolved.

## Evidence

- CI log snippet (`#13 4.613`):
  - `npm warn deprecated glob@10.5.0: ... contain widely publicized security vulnerabilities ...`

## Investigation Scope

- Identify which direct or transitive dependency pulls `glob@10.5.0`.
- Determine whether patched `glob` is available via upstream updates.
- Decide remediation path:
  - upgrade parent package(s),
  - enforce override/resolution at root,
  - or document accepted risk with expiration date if blocked.

## Acceptance Criteria

- CI no longer emits deprecated `glob@10.5.0` warning.
- Dependency graph shows patched/non-deprecated `glob` version(s).
- Change is documented with affected package path and validation command output.

## Suggested Validation

```bash
npm ls glob
npm audit --omit=dev
npm audit
```

## Status

Open

## Engineering Handoff
- `change_summary`:
- `validation_evidence`:
- `qa_focus`:
- `open_risks`:

## QA Verdict
- `verdict`:
- `evidence_quality`:
- `defects`:
- `state_transition`:
