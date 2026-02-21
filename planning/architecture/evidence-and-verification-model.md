<!-- AUDIENCE: Internal/Technical -->

# Evidence and Verification Model (Stage 8)

## Purpose

Define how run-time evidence is collected, persisted, and evaluated into `RunResult` verification outcomes.

## Core Components

- Runtime attachment hook: `RuntimeRunOptions.onAttachEvidence`
- Run orchestration: `LocalRunService` (`src/control-plane/services.ts`)
- Persistence: `FileStateStore` (`src/control-plane/state-store.ts`)
- Contract surface: `src/shared/contracts.ts`

## Evidence Lifecycle

1. Runtime emits evidence attachments during a run.
2. `LocalRunService` validates attachments and verifies run is active.
3. Evidence records are persisted under the run identity.
4. Final run response includes `evidenceCount`.

## Verification Policy Model

Verification policies are defined per Harness Profile:

```ts
interface HarnessProfile {
  verificationPolicies?: HarnessVerificationPolicy[];
}
```

Current supported policy kind:

- `require-evidence`
  - Optional `evidenceType`: `text | json | binary`

Policy evaluation occurs in `LocalRunService.applyVerificationPolicies`.

## Run Result Contract

After evaluation, `RunResult` may include:

- `verificationStatus`: `passed` or `verification-failed`
- `verificationFailures`: array of policy failure diagnostics

When no verification policies exist, status resolves to `passed`.

## Backward Compatibility

Verification fields are optional in `RunResult` for compatibility with older clients and legacy run flows.

## Operational Guidance

- Use verification policies for non-negotiable execution quality gates.
- Keep policy IDs stable; consumers may key alerting/metrics by `policyId`.
- Prefer narrow, evidence-type-specific policies to improve debuggability of failures.
