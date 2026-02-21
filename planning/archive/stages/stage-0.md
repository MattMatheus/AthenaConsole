<!-- AUDIENCE: Internal/Technical -->

# Stage 0: Foundation And Scaffolding

## Objectives

- Establish repository/tooling baseline.
- Define shared contracts for runtime/work/memory.
- Create module scaffolding for planned architecture.
- Add starter tests and docs.

## Implemented

- `package.json` with scripts:
  - `build`
  - `typecheck`
  - `test`
  - `lint`
- `tsconfig.json` and `vitest.config.ts`
- Source scaffolding:
  - `src/cli`
  - `src/runtime`
  - `src/work`
  - `src/memory`
  - `src/context`
  - `src/providers`
  - `src/tools`
  - `src/shared`
- Contracts in `src/shared/contracts.ts`
- Config loader (`.env` + process env fallback) in `src/shared/config.ts`
- Distill placeholder in `src/context/index.ts`
- Baseline tests in `tests/config.test.ts` and `tests/contracts.test.ts`

## Exit Criteria Check

- Build/test/typecheck scripts exist: yes.
- Shared contracts are defined and importable: yes.
- Stage 0 docs are created and linked: yes.
- Verification commands run successfully:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## Known Gaps For Stage 1

- No actual `athena run` command yet.
- No persisted session/transcript manager yet.
- Runtime currently uses mock execution echo behavior only.
