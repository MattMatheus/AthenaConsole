---
kind: bug
id: BUG-20260528-glob10-deprecation-warning
status: done
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
- `status`: done
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

Engineering complete

## Engineering Handoff
- `change_summary`: Upgraded `@athena/core` test tooling from `vitest`/`@vitest/coverage-v8` 3.x to 4.1.7 in `packages/core/package.json`, regenerated the workspace and package-local lockfiles, and removed the `@vitest/coverage-v8@3.2.4 -> test-exclude@7.0.1 -> glob@10.5.0` dependency path. While validating coverage under Vitest 4, fixed a same-process concurrent session atomic-write race by making temp file names UUID-scoped, and updated two tests for Vitest 4 coverage/unhandled-rejection behavior.
- `validation_evidence`: `npm ls glob` now reports `(empty)` at the workspace root, so no deprecated `glob@10.5.0` remains in the installed graph. `rg 'glob-10\\.5\\.0|test-exclude-7\\.0\\.1' package-lock.json packages/core/package-lock.json` returns no matches. `npm --workspace @athena/core run typecheck` passed. `npm --workspace @athena/core run test:unit -- tests/api.router.test.ts tests/runtime.lock.test.ts` passed with 15 tests. `npm --workspace @athena/core run test:unit -- tests/runtime.context-overflow.test.ts` passed with 3 tests. `npm --workspace @athena/core run test:coverage` passed with 83 files and 391 tests.
- `qa_focus`: Confirm the dependency graph no longer contains `glob@10.5.0`, Vitest 4 coverage still satisfies configured thresholds, and the session lock test remains stable with concurrent writes.
- `open_risks`: `npm audit --omit=dev` and `npm audit` still report pre-existing vulnerability findings unrelated to the removed `glob@10.5.0` path; the audit counts improved during the dependency refresh but are not fully clean.

## QA Verdict
- `verdict`: Pass. Acceptance is met because the installed workspace graph no longer contains `glob`, both lockfiles no longer contain `glob@10.5.0` or `test-exclude@7.0.1`, and the affected coverage provider now resolves to `@vitest/coverage-v8@4.1.7`.
- `evidence_quality`: Good. Validation included dependency graph checks, lockfile grep checks, core typecheck, focused regression tests, full coverage, and both requested audit commands.
- `defects`: None blocking. Audit commands still fail due known unrelated dependency advisories outside the `glob@10.5.0` path.
- `state_transition`: Move to `done`.

## Transition History
- `2026-05-28T15:40:01Z`: `intake` -> `active` by `Codex`; Engineering started
- `2026-05-28T15:46:43Z`: `active` -> `qa` by `Codex`; Engineering handoff complete
- `2026-05-28T15:46:56Z`: `qa` -> `done` by `Codex`; QA passed
