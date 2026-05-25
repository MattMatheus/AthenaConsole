<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator Roadmap

This roadmap outlines the key milestones for Team Orchestrator as it evolves from a local agent runner into a production-grade, distributed orchestration platform.

## Milestone 1: Core Foundation & API Maturity (COMPLETE)
*Focus: Stabilizing the control plane, ensuring reliability, and preparing for distributed operations.*

- [x] **Distributed Concurrency:** Implement a pluggable locking interface with support for Redis or Kubernetes Leases.
- [x] **Run Correlation & Audit:** Finalize `runId` migration and event-driven tracking for run rejections and lifecycle changes.
- [x] **Architectural Refactoring:** Transition from a monolithic runner to a structured Orchestrator with deterministic route precedence.
- [x] **API Standards:** Enforce server-authored timestamps and cursor-based pagination for history and observability.
- [x] **Identity Foundation:** Design and implement the RBAC model (Roles, Actions, Scopes) with fail-closed rollout controls.

## Milestone 2: Structured Workflow Orchestration (COMPLETE)
*Focus: Moving from raw agent runs to reusable, auditable, and deterministic workflows.*

- [x] **Directive Resource:** Decouple structured user intent from agent execution configuration.
- [x] **Harness Profiles:** Explicit base-agent envelopes defining tools, budgets, safety switches, and verification policies.
- [x] **Run Templates:** Parameterized job templates for repeatable execution.
- [x] **Workflow DAGs:** Orchestrate multi-step agent tasks with dependency management and crash-safe resumption.
- [x] **Verification & Evidence:** Establish a first-class evidence model to verify and trust agent outputs.

## Milestone 3: Safe Execution & Developer Experience (COMPLETE)
*Focus: Hardening the execution environment and streamlining agent development.*

- [x] **Containerized Backends:** Implement Docker and Kubernetes execution providers for "least privilege" command execution.
- [x] **Safety Enforcement:** Real-time policy enforcement for resource limits (CPU/Memory), network gating, and filesystem scoping.
- [x] **Persona Development Kit (PDK):** Launch `@projectathena/pdk` with scaffolding, typed definitions, and a `MockRuntime` for local testing.
- [x] **Symbolic Navigation:** Integrate LSP-first tools to improve agent reasoning over large-scale codebases.

## Milestone 4: Fleet Management & Governance (IN PROGRESS)
*Focus: Operator observability and multi-user governance.*

- **Admin Dashboard:** Centralized web UI for fleet health, resource utilization, and cost monitoring.
- **Session Explorer:** Deep-dive inspection of real-time transcripts, work queues, and artifacts.
- **Policy Editor:** Visual management of concurrency, retries, and timeout policies.
- **A2A Observability:** Message throughput visualization and Dead-Letter Queue (DLQ) management.
- **RBAC Enforcement:** Full implementation of role-based access control across all API resources.

## Milestone 5: Cloud-Native & Azure Deployment (UPCOMING)
*Focus: Scaling the platform to Azure using startup credits and production-grade infrastructure.*

- [ ] **Infrastructure-as-Code (Terraform):** Provision AKS, ACR, Redis, and Static Web Apps in `East US`.
- [ ] **Custom Domain & SSL:** Deploy the web console to `athena.teamorchestrator.com` with managed certificates.
- [ ] **Continuous Delivery (GitHub Actions):** Build and deploy containerized API and Runner images to ACR/AKS.
- [ ] **Managed Identity (Workload Identity):** Replace static API keys with Azure Managed Identity for service-to-service auth (KeyVault, OpenAI).
- [ ] **Cloud Observability:** Integrate Azure Application Insights for cross-plane distributed tracing.
- [ ] **Cost Governance:** Implement automated budget alerts and burstable node scaling to optimize credit usage.
