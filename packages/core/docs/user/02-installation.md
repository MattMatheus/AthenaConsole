# Installation and Configuration

Team Orchestrator is a TypeScript workspace with a web console and a core runtime package. This package-level page focuses on local core runtime compatibility; for the current product quickstart, use `../../../GETTING_STARTED.md`.

## Prerequisites

- Node.js (version 20 or higher)
- npm (comes with Node.js)

## Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd projectathena
    ```

2.  **Install Dependencies:**
    Use npm to install the project dependencies as defined in `package.json`.
    ```bash
    npm install
    ```

3.  **Build the Project:**
    The project's TypeScript source code must be compiled into JavaScript.
    ```bash
    npm run build
    ```
    This will create the distributable files in the `dist/` directory.

## Initial Configuration

The core runtime can be configured via environment variables. The runtime will load these on startup. Historical `ATHENA_*` names remain the supported configuration keys.

### Configuration (Quick Start)

1. Create your local env file from the template:
   ```bash
   cp .env.example .env
   ```
2. Set the provider/model defaults used by runtime and CLI:
   - `ATHENA_DEFAULT_PROVIDER` (default: `foundry`)
   - `ATHENA_PROVIDER_FALLBACK_ORDER` (default: `openai`)
   - `ATHENA_DEFAULT_MODEL` (example: `gpt-4o-mini`)
3. Configure Microsoft Foundry (primary provider):
   - `ATHENA_FOUNDRY_PROJECT_ENDPOINT`: Foundry project endpoint URL.
   - `ATHENA_FOUNDRY_DEPLOYMENT`: Deployment name used for inference routing.
   - `ATHENA_FOUNDRY_API_VERSION`: API version query parameter (default: `2024-05-01-preview`).
   - `ATHENA_FOUNDRY_USE_ENTRA_ID`: Enables `DefaultAzureCredential` token auth (default: `true`).
   - `ATHENA_FOUNDRY_AUDIENCE`: Token audience/scope (default: `https://cognitiveservices.azure.com/.default`).
   - Optional: `ATHENA_FOUNDRY_MANAGED_IDENTITY_CLIENT_ID`.
   - Optional explicit fallback: `ATHENA_FOUNDRY_API_KEY`.
4. Configure OpenAI-compatible connectivity for fallback/compatibility:
   - `ATHENA_OPENAI_API_KEY`: API key/token for your OpenAI-compatible provider.
   - `ATHENA_OPENAI_BASE_URL`: Base URL for OpenAI-compatible APIs (default: `https://api.openai.com/v1`).

Notes:
- For local Entra ID auth, run:
  ```bash
  az login
  ```
  `DefaultAzureCredential` will pick up your Azure CLI session.
- `ATHENA_OPENAI_BASE_URL` can point to OpenAI-compatible services (for example Groq or an Ollama-compatible gateway).
- If `ATHENA_DEFAULT_PROVIDER=openai`, `ATHENA_OPENAI_API_KEY` should be set.

### Core Telemetry and Events

-   `ATHENA_EVENTS_MAX_RECORDS`: Controls the maximum number of event records to retain in the event ledger (default: 10,000).
-   `ATHENA_EVENT_RETENTION_DAYS`: Sets event age retention in days before pruning (default: 30).
-   `ATHENA_EVENT_MAX_BYTES`: Sets the maximum size (in bytes) for the event ledger (default: 5MB).
-   Legacy keys remain supported for compatibility: `ATHENA_EVENTS_MAX_AGE_MS`, `ATHENA_EVENTS_MAX_BYTES`.

### Operations Metrics Configuration

-   `ATHENA_OPERATIONS_METRICS_PROVIDER`: Specifies the provider for operations metrics. Options are `local` (default) or `k8s`.
-   `ATHENA_K8S_AGENT_LABEL_SELECTOR`: For `k8s` provider, the label selector used to find agent pods (default: `app.kubernetes.io/component=athena-agent`).
-   `ATHENA_K8S_NAMESPACE`: For `k8s` provider, the namespace to search for pods. If unset, the default context namespace is used.

### Distributed Locking and Concurrency

-   `ATHENA_EXECUTION_PROVIDER_DEFAULT`: Default sandbox execution provider for local routing. Supports `docker` (default), `k8s`, or `local-placeholder`.
-   `ATHENA_LOCK_PROVIDER_DEFAULT`: Default distributed lock provider. Supports `local` (default), `redis`, or `k8s-lease`.
-   `ATHENA_DISTRIBUTED_LOCK_PROVIDER`: Specifies the backend for managing distributed locks. Supports `local` (default), `redis`, or `k8s-lease`.
-   `ATHENA_REDIS_URL`: Redis connection URL used when `ATHENA_DISTRIBUTED_LOCK_PROVIDER=redis`.
-   `ATHENA_K8S_NAMESPACE`: Optional namespace override for `k8s-lease` distributed locking. If unset, Athena uses the pod service-account namespace or current kube context namespace.
-   `ATHENA_POLICY_REJECTION_MAX_RECORDS`: Maximum number of policy rejection events to retain in the audit log (default: 500).

### API Identity and RBAC Mapping

-   `ATHENA_AUTH_ENABLED`: Enables request identity extraction middleware for API calls (default: `false`).
-   `ATHENA_AUTH_IDENTITY_HEADER`: Header name used for principal extraction (default: `x-athena-identity`).
-   `ATHENA_AUTH_DEFAULT_ROLE`: Role assigned when an identity is not present in the explicit map (`Viewer`, `Operator`, or `Admin`; default: `Viewer`).
-   `ATHENA_AUTH_IDENTITY_ROLE_MAP`: Comma-separated identity-to-role mappings in `identity:role` format (example: `alice:Admin,bob:Operator,*:Viewer`).

When `ATHENA_AUTH_ENABLED=true`, requests missing the identity header are rejected with a fail-closed authentication error.

### Runtime Isolation Profiles

-   `ATHENA_RUNTIME_ISOLATION_DEFAULT_PROFILE`: Default isolation profile for run orchestration policy decisions. Supported values: `standard`, `high-security` (default: `standard`).
-   `ATHENA_RUNTIME_ISOLATION_STANDARD_RUNTIME_CLASS`: Optional Kubernetes `RuntimeClass` name for the `standard` profile. Empty/unset uses the cluster runtime default.
-   `ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_RUNTIME_CLASS`: Optional Kubernetes `RuntimeClass` name for the `high-security` profile. Empty/unset uses the cluster runtime default.
-   `ATHENA_RUNTIME_ISOLATION_STANDARD_REQUIRE_SANDBOX`: Whether `standard` profile requires sandbox routing (`true`/`false`, default: `false`).
-   `ATHENA_RUNTIME_ISOLATION_HIGH_SECURITY_REQUIRE_SANDBOX`: Whether `high-security` profile requires sandbox routing (`true`/`false`). If unset, Athena preserves legacy behavior using `ATHENA_SANDBOX_REQUIRE_FOR_HIGH_SECURITY` (default: `false`).
-   `ATHENA_RUNTIME_ISOLATION_FALLBACK_TO_DEFAULT_RUNTIME_CLASS`: Whether profile runtime class resolution may fall back to the default runtime class hint (`true`/`false`, default: `true`).

Invalid runtime isolation values now fail fast at startup with a `CONFIG_ERROR`.

### Scheduler Configuration

-   `ATHENA_SCHEDULE_RUN_TIMEOUT_MS`: Default timeout for a scheduled task run (default: 0, which means no timeout).

Provider env support for Foundry and OpenAI keys/endpoints is implemented in `src/shared/config.ts`.

## Verifying the Installation

You can verify that the installation was successful by running the `athena` CLI and viewing the help output.

```bash
npm run athena -- --help
```

Or, you can use the globally-linked binary if you have set it up:

```bash
athena --help
```

This will display the main command list, confirming that the CLI is executable.
