<!-- AUDIENCE: Operator -->

# Providers, Memory, and Repositories

This page covers the three resource types that agent work depends on: model providers, memory backends, and repository context.

---

## Model Providers

A provider is a configured model or API backend. Team Orchestrator supports OpenAI-compatible endpoints and Azure AI Foundry deployments.

### The First-Run Demo Does Not Need Credentials

The first-run demo uses a mock provider. You do not need API credentials to prove the control plane works. Model-backed agents do need credentials.

### Configuring Providers via Environment Variables

For OpenAI-compatible providers:

```env
ATHENA_DEFAULT_PROVIDER=openai
ATHENA_OPENAI_API_KEY=your_api_key_here
ATHENA_OPENAI_BASE_URL=https://api.openai.com/v1
```

`ATHENA_OPENAI_BASE_URL` can point to any OpenAI-compatible endpoint (for example Groq or an Ollama-compatible gateway).

For Azure AI Foundry:

```env
ATHENA_DEFAULT_PROVIDER=foundry
ATHENA_FOUNDRY_ENABLED=true
ATHENA_FOUNDRY_PROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com
ATHENA_FOUNDRY_DEPLOYMENT=<your-deployment-name>
ATHENA_FOUNDRY_API_VERSION=2024-05-01-preview
ATHENA_FOUNDRY_USE_ENTRA_ID=true
```

Run `az login` before starting the API when using Foundry with Entra ID locally.

### Configuring Providers via the Console

Open **Settings** in the console to create and manage provider records without restarting the API. Provider readiness appears in health/readiness responses and in agent/workflow create paths. If a model-backed agent is blocked, the product explains what provider is missing or invalid before you start a run.

### Provider Readiness

Check which providers are configured and reachable:

```bash
curl http://127.0.0.1:8787/api/v1/readiness
```

Each provider check includes a `nextStep` field when degraded. Common causes:

- missing environment variable,
- incorrect secret name,
- Azure Entra ID session expired (run `az login` again),
- provider kind does not match the agent requirement.

### Provider Fallback

```env
ATHENA_PROVIDER_FALLBACK_ORDER=openai
ATHENA_DEFAULT_MODEL=gpt-4o-mini
```

When the primary provider is unavailable, Team Orchestrator can fall back to the next provider in the fallback order.

---

## Memory Backends

Memory backends store and retrieve semantic or key-value context that agents can use across runs.

### Default Memory Backend

The default local memory backend uses in-memory storage. It does not persist across API restarts unless a durable backend is configured.

### Chroma Semantic Memory

For persistent semantic memory, configure the Chroma adapter. See [Chroma Semantic Memory Adapter](../developer/product-dev-guides/chroma-semantic-memory-adapter.md) for setup and configuration.

### Memory Environment Variables

| Variable | Purpose |
|----------|---------|
| `ATHENA_MEMORY_BACKEND` | Memory backend type (`local`, `chroma`) |
| `ATHENA_CHROMA_URL` | URL for the Chroma server when using the Chroma backend |

---

## Repositories

Repository context tells agents what source tree or workspace they should operate on.

### Docker/Podman Compose

For local compose, mount a target repo with environment variables in your compose environment:

```env
ATHENA_REPO_HOST_PATH=/absolute/path/to/your/repo
ATHENA_REPO_CONTAINER_PATH=/workspace/target-repo
```

Then use `/workspace/target-repo` in task or workflow inputs. This keeps host paths and container paths explicit.

### Direct Development

For direct local development, set `ATHENA_WORKSPACE_ROOT` to the repo root:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

### Repository Wiring in the Console

Open `/resources` in the console to review repository wiring guidance and confirm the agent receives the correct path.

### Multiple Repositories

To expose multiple repositories, configure multiple mount paths and reference them by container path in task inputs. Repository records in the product store paths and metadata; the agent manifest declares whether repo context is a required input.

---

## Next Steps

- [Running Work](05-running-work.md) — create and run tasks once providers and repos are configured
- [Cost Governance](07-cost-governance.md) — track and (eventually) limit provider usage
- [Troubleshooting](09-troubleshooting.md) — provider-backed agent blocked, readiness degraded
