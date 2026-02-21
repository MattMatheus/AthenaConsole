# Stage 2: Provider Abstraction And Fallback

## Objectives

- Expand runtime provider abstraction beyond mock-only execution.
- Support both local execution and remote endpoint provider patterns.
- Add ordered provider fallback for retryable provider failures.

## Implemented

- Provider adapters:
  - `mock` provider for deterministic local test/runtime behavior.
  - `local-exec` provider to call local executables.
  - `http` provider for remote model gateway style integrations.
- Provider registry now supports:
  - adapter registration
  - adapter retrieval
  - adapter listing
- Runtime fallback behavior:
  - resolves provider order from primary provider + configured fallback list
  - retries per provider for retryable failures
  - advances to next provider when current provider fails retryably
  - returns explicit provider-not-found error when no usable provider exists
- Session metadata handling:
  - final provider/model used are persisted after fallback resolution

## Config Additions

- `ATHENA_PROVIDER_FALLBACK_ORDER` (comma-separated provider IDs)
- `ATHENA_LOCAL_PROVIDER_CMD`
- `ATHENA_LOCAL_PROVIDER_ARGS` (comma-separated)
- `ATHENA_HTTP_PROVIDER_URL`
- `ATHENA_HTTP_PROVIDER_API_KEY`
- `ATHENA_HTTP_PROVIDER_TIMEOUT_MS`

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added

- `tests/runtime.fallback.test.ts`
  - verifies fallback to next provider on retryable failure
- `tests/providers.local-exec.test.ts`
  - verifies local-exec provider runs local binary and returns output
- `tests/config.test.ts` updated
  - verifies Stage 2 config fields are parsed from `.env`

## Known Gaps

- No concrete production provider auth flows yet (only generic HTTP adapter contract).
- Provider health scoring/latency-aware fallback is not implemented.
- Streaming provider responses are deferred.
