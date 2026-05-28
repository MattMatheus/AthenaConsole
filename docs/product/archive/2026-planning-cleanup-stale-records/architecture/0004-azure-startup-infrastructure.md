<!-- AUDIENCE: Internal/Technical -->

# ADR 0004: Azure Startup Infrastructure Design

## Status
Deferred by 2026 product-direction reset.

This ADR is retained as historical cloud infrastructure context. The current product direction is local-first execution with room for future hosted/API backends; Azure deployment is not the active product center.

## Context
Project Athena is transitioning from a local-only development phase to a cloud-hosted environment to leverage Azure Startup Credits. The design must minimize "burn rate" while providing a representative environment for platform engineering (building the platform on the platform).

The platform requires:
- A web console for user interaction.
- A control plane (API) for orchestration.
- An execution plane for persona runtimes.
- Managed AI services (OpenAI).
- Scalable state management and locking.

## Decision
We will deploy Project Athena to **Azure** using the following service stack:

1.  **Region**: `East US` (Optimized for Azure OpenAI model availability and cost).
2.  **Web Plane**: **Azure Static Web Apps (SWA)**.
    - Tier: Free (upgradable to Standard).
    - Domain: `athena.teamorchestrator.com`.
3.  **Control Plane**: **Azure Kubernetes Service (AKS)**.
    - Tier: Free (no SLA).
    - VM Size: `Standard_B2s` (Burstable nodes to save credits).
    - Logic: Handles API requests and manages K8s Job lifecycles for persona runs.
4.  **Registry**: **Azure Container Registry (ACR)**.
    - Tier: Basic.
5.  **State Management**:
    - **Locks**: **Azure Cache for Redis** (Basic C0).
    - **Files**: **Azure Files** (Standard LRS) mounted as Persistent Volumes.
6.  **AI Backend**: **Azure OpenAI Service**.
    - Model: GPT-4o (Standard Pay-as-you-go).
7.  **Observability**: **Azure Monitor / Application Insights**.
8.  **Infrastructure-as-Code**: **Terraform** (Hashicorp).
9.  **CI/CD**: **GitHub Actions**.

## Rationale
- **AKS**: The codebase already implements a `K8sSandboxExecutionBackend`. Using AKS allows us to maintain consistency between development and production.
- **SWA**: Provides the best developer experience for Vite-based React apps with built-in CDN and SSL.
- **Redis**: The `RedisLockProvider` is already implemented; using Azure Redis is a drop-in replacement for local memory locks, enabling multi-node scalability.
- **Cost**: By using "Free" and "Basic" tiers, we maximize the longevity of the startup credits.

## Consequences
- **CORS**: The API must explicitly allow `athena.teamorchestrator.com`. (Implemented in ADR implementation phase).
- **Networking**: AKS API server access is restricted to the developer's Fixed IP for security.
- **State Persistence**: Azure Files (Standard) may have higher latency than local disks; however, for text-only transcripts and small metadata, this is acceptable for the current phase.
- **Managed Identity**: While initially using API keys, the roadmap includes a transition to Managed Identity (Workload Identity) for all service-to-service communication.

## Implementation Notes
- Use `athena.teamorchestrator.com` for the console.
- Configure `ATHENA_ALLOWED_ORIGINS` in the cloud environment.
- Use `infrastructure/terraform` for all provisioning.
