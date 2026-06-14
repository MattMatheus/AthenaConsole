<!-- AUDIENCE: Public/Internal -->

# Release Readiness

Release readiness records describe what is shippable, how it is validated, and which risks remain explicit for a given Team Orchestrator release train.

## Current Release Candidate

- [2026.1 Release Readiness](2026.1.md)

## Release Labeling

Team Orchestrator uses calendar release labels for product releases:

- `YYYY.N`, where `YYYY` is the release year and `N` is the sequence number in that year.
- The first release candidate for the local-first product baseline is `2026.1`.

Product release labels are separate from internal npm workspace package versions and sample plugin manifest versions. Keep package versions on their own semver path until package publishing becomes part of the release process.

## Current Direction Note

`2026.1` remains a local-first release candidate. Current `main` has moved into the enterprise/multi-user direction accepted in [ADR 0027](../architecture/decisions/0027-enterprise-multi-user-direction.md), so release notes should distinguish historical release scope from current roadmap scope.
