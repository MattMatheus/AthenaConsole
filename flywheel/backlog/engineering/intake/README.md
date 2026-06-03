# Engineering Intake

Raw engineering work enters here before PM refinement.

## Candidate Sequence

1. `STORY-20260602-connector-external-write-approvals.md`
2. `STORY-20260602-connector-readiness-diagnostics.md`

## PM Refinement Notes

- These five intake stories break down Epic 2026.40 Connector Pack Platform.
- Recommended refinement order starts with connector manifest extensions, then credential binding, then external write approvals, readiness diagnostics, and mock fixture harness.
- Keep service-specific GitHub, Slack, Notion, Google, Linear, or Jira connector implementations out of these stories; those belong to later epics.

## Refinement Rule

PM refinement should turn intake items into bounded, testable stories before moving them to `ready/` or `active/`.
