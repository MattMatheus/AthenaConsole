<!-- AUDIENCE: Internal/Technical -->

# ADR 0005: Foundry-First Model Provider Integration

## Status
Proposed

## Context
Athena currently routes model calls through a provider registry with `openai` as the primary hosted-model path.
We need to make Microsoft Foundry AI the premier integration path while preserving direct OpenAI-key support for compatibility and portability.

Existing architecture already provides:
- Provider abstraction boundary (`ProviderAdapter`, `ProviderRegistry`)
- Runtime fallback routing (`defaultProvider`, `providerFallbackOrder`)
- Azure identity/key-vault token/key acquisition helpers

## Decision
Adopt a **Foundry-first** provider strategy using a dedicated `foundry` provider adapter and explicit routing defaults.

1. Add a new provider adapter: `FoundryProviderAdapter` (`id: "foundry"`).
2. Keep `OpenAIProviderAdapter` unchanged for direct API-key usage and compatibility.
3. Set deployment defaults to Foundry first:
   - `ATHENA_DEFAULT_PROVIDER=foundry`
   - `ATHENA_PROVIDER_FALLBACK_ORDER=openai`
4. Add Foundry-specific configuration in `AthenaConfig`:
   - `ATHENA_FOUNDRY_ENABLED`
   - `ATHENA_FOUNDRY_PROJECT_ENDPOINT`
   - `ATHENA_FOUNDRY_DEPLOYMENT`
   - `ATHENA_FOUNDRY_API_VERSION`
   - `ATHENA_FOUNDRY_USE_ENTRA_ID`
   - `ATHENA_FOUNDRY_AUDIENCE`
   - `ATHENA_FOUNDRY_MANAGED_IDENTITY_CLIENT_ID` (optional)
   - `ATHENA_FOUNDRY_API_KEY` (optional, non-preferred)
5. Use Entra ID token auth as the preferred mode; API key is explicit fallback only.

## Component Breakdown
- **Runtime (`runtime/index.ts`)**
  - No contract changes; continues routing by provider id with retries/fallbacks.
- **Provider Registry (`providers/index.ts`)**
  - Registers `foundry` and `openai` adapters.
- **Foundry Auth Helper (`providers/foundry-auth.ts`)**
  - Resolves/caches bearer token from `DefaultAzureCredential`.
- **Foundry Adapter (`providers/foundry.ts`)**
  - Builds Foundry inference endpoint and maps response to `RunResult`.
- **Config Loader (`shared/config.ts`)**
  - Parses and validates Foundry env configuration.

## Interface Definitions
- Keep `RunRequest` and `RunResult` stable.
- New provider id: `foundry`.
- Additional run metadata keys (for observability):
  - `providerRoute=foundry`
  - `foundryDeployment=<deployment>`
  - `authMode=entra|api-key`

## Tradeoffs
- **Pros**
  - Azure-native identity/governance path as the default.
  - Reuses existing provider abstraction with minimal runtime churn.
  - Preserves OpenAI portability via fallback/direct provider selection.
- **Cons**
  - Extra endpoint/config surface to validate.
  - Token lifecycle and deployment naming add operational complexity.

## Risks and Mitigations
- **Misconfigured deployment/endpoint**  
  Mitigation: fail-fast config validation and startup health checks.
- **Token acquisition failures**  
  Mitigation: classify retryable vs non-retryable errors; preserve fallback to `openai`.
- **Silent provider drift**  
  Mitigation: emit provider/deployment/auth metadata in run telemetry and audit events.

## Consequences
- Foundry becomes the primary managed-model path for Athena.
- OpenAI direct-key path remains supported for local/dev and multi-vendor resilience.
- Operational runbooks must include Foundry endpoint/deployment and identity prerequisites.
