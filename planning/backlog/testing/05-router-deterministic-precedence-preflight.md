<!-- AUDIENCE: Internal/Technical -->

# SDET Preflight: 10.01 Deterministic Route Precedence

## Scope

- Story: `planning/backlog/active/10.01-implement-deterministic-route-precedence.md`
- Phase: Preflight (authoritative worktree signal: clean)

## Given/When/Then Acceptance Criteria

1. Given route definitions that include both static and parameterized candidates for the same method/shape, when `APIRouter.findMatch()` runs, then static routes are matched before parameterized routes regardless of declaration order.
2. Given two parameterized candidates with different specificity (for example `"/a/:b/c"` and `"/a/:b/:c"`), when matching a compatible path, then the more specific route (more static segments) is matched first.
3. Given multiple routes with equal specificity, when matching a path, then tie-breaking is deterministic and documented (stable and reproducible across process restarts).
4. Given deterministic precedence in matching, when `dispatch()` is called, then the invoked handler corresponds to the deterministically selected route and returns `true`.
5. Given no matching route for method/path, when `dispatch()` is called, then it returns `false` and does not invoke any handler.
6. Given invalid route parameter declarations (for example empty key after `:`), when matching is attempted, then the route is treated as non-match and matching continues deterministically.

## Ambiguities To Resolve Before Implementation

1. Sorting scope: global route-table sort vs method-scoped sort.
2. Tie-break policy for equal specificity routes (preserve declared order vs lexical path sort).
3. Precompile timing: one-time sort in constructor only (expected) vs per-request sort (not expected).
4. Normalization interactions: whether repeated slashes and percent-encoded path segments are in/out of story scope.
5. Backward compatibility rule for callers that currently rely on declaration order.

## Test Matrix

| ID | Scenario | Level | File | Expected |
| --- | --- | --- | --- | --- |
| AC1-U1 | static beats parameterized even if declared after | Unit | `tests/api.router.test.ts` | static handler called |
| AC2-U2 | `"/a/:b/c"` beats `"/a/:b/:c"` | Unit | `tests/api.router.test.ts` | more-static route matched |
| AC3-U3 | deterministic tie for equal specificity routes | Unit | `tests/api.router.test.ts` | stable selected route |
| AC4-U4 | dispatch delegates to deterministically matched route | Unit | `tests/api.router.test.ts` | correct handler + `true` |
| AC5-U5 | unmatched route returns `false` | Unit | `tests/api.router.test.ts` | no handler calls |
| AC6-U6 | malformed parameter key route does not match | Unit | `tests/api.router.test.ts` | undefined match |
| INT1 | API server route family resolution remains stable for colliding shapes | Integration | `tests/api.server.test.ts` | expected route/family chosen |
| INT2 | server 404 behavior unchanged for misses after precedence update | Integration | `tests/api.server.test.ts` | 404 envelope unchanged |
| CTR1 | no shared DTO/schema changes introduced by router-only story | Contract | `tests/schema-generation.test.ts`, `tests/control-plane.api-artifact.test.ts` | unchanged/passing |
| E2E1 | representative CLI/API path still routes correctly (`schedules/tick`) | E2E | existing CLI/API suites | behavior unchanged |

## Negative and Boundary Coverage Requirements

- Malformed input:
  - invalid parameter key route remains non-match
  - unknown method/path misses remain non-match
- Boundary:
  - equal segment-count collisions with mixed static/parameterized segments
  - equal-specificity tie case is deterministic
- Timeout/abort:
  - no new timeout path in router; retain regression signal via full suite (`tests/runtime.timeout.test.ts`, `tests/runtime.cancel.test.ts`)
- Lock contention:
  - no new lock path in router; retain regression signal via full suite (`tests/session-lock.test.ts`, `tests/control-plane.policy-fleet.test.ts`)
- Persistence recovery:
  - no persistence writes in router; retain regression signal via full suite (`tests/work.manager.test.ts`, `tests/schedule.manager.test.ts`)

## Observability Assertions

1. API error envelope and `traceId` behavior remain unchanged for no-match (`404`) and handler-thrown errors.
2. Existing lifecycle/error codes are unchanged (router precedence does not introduce new codes).
3. No regression in existing reliability metadata surfaces from runtime/control-plane flows.

## Risks

1. Existing tests currently encode declaration-order precedence (`tests/api.router.test.ts`), which conflicts with story intent and must be updated atomically with implementation.
2. Missing explicit tie-break specification for equal-specificity routes can reintroduce nondeterminism.
3. If sorting is not method-aware, routes from other methods could affect precedence ordering unexpectedly.
