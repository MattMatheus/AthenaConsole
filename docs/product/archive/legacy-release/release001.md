<!-- AUDIENCE: Internal/Technical -->

# Release 001: The Age of Orchestration

This inaugural release marks the evolution of Project Athena from a single-agent runner to a true multi-agent orchestrator. It introduces foundational capabilities for security, governance, and developer experience, setting the stage for robust, production-grade autonomous operations.

## 🚀 New Features

### Workflow Engine
- **Multi-Step Workflows (DAGs):** Define and execute complex, multi-step agent tasks as a Directed Acyclic Graph (DAG). The system includes a parser to validate the graph structure and supports parallel execution for independent steps.
- **Stateful Resumption:** Workflows are now stateful and persistent. Failed or interrupted workflows can be resumed from the last successfully completed step, saving significant time and resources.
- **Workflow Observability API:** A new set of API endpoints allows for real-time monitoring of workflow progress, providing a detailed status for each node in the graph.

### Persona Development Kit (PDK)
- **`@projectathena/pdk` NPM Package:** A new, typed Software Development Kit has been launched to standardize and accelerate persona development.
- **Typed Interfaces:** The PDK exports TypeScript interfaces for all core persona resources, enabling IDE support and reducing common configuration errors.
- **Scaffolding:** A new CLI command, `athena persona init <name>`, scaffolds a complete, validated persona directory structure with a single command.
- **Unit Test Harness:** A `PersonaTestHarness` with a `MockRuntime` is now included, allowing developers to unit test persona logic (context assembly, prompt construction, output parsing) without needing to perform a full, expensive end-to-end run.

### Run Templates
- **Reusable Automation:** Define `RunTemplate` resources that capture a specific agent configuration (`HarnessProfile`) and a parameterized `Directive`.
- **Trigger via API & CLI:** Execute complex, recurring tasks with simple parameter overrides via `POST /api/v1/templates/:id/run` or `athena run --template <id> --param ...`.

### Evidence & Verification Framework
- **Verifiable Proof of Work:** Agents can now attach `Evidence` (logs, test results, etc.) to their runs using a new `runtime.attachEvidence()` hook in the PDK.
- **Secure Persistence:** Evidence is stored securely with the run artifacts in a content-addressable manner, with checksums recorded in an `evidenceManifest` for integrity.
- **Automated Verification Policies:** Harness Profiles can now define `verificationPolicies` that require specific evidence to be present before a run can be marked as successful, moving the system from "agent says" to "agent proves."

## 🔐 Security & Governance

### Role-Based Access Control (RBAC)
- **Comprehensive RBAC Coverage:** All system resources and API endpoints are now protected by RBAC, including Sessions, Directives, Workflows, and Memory.
- **Scoped Access Enforcement:** Roles can now be scoped to specific resources (e.g., a user can be restricted to only run specific personas), providing fine-grained, mission-level access control.
- **Phased Rollout:** A new `authz.mode` allows for safe rollout of RBAC policies, moving from `observe` to `soft-enforce` to full `enforce` mode, preventing disruption to production workloads.
- **Identity Middleware:** A new middleware layer extracts caller identity, maps it to roles, and enforces authorization checks on every request.

### Sandboxed Execution
- **Docker & Kubernetes Providers:** The system now includes two production-ready sandbox execution providers. A **Docker** provider enables local development and testing, while a **Kubernetes Pod** provider offers production-grade isolation.
- **Workspace Syncing:** A reliable mechanism was implemented to mount or sync the code workspace into the isolated container environment.
- **Resource Quota Enforcement:** Runaway workloads are prevented by a new monitor that terminates runs exceeding configured CPU, memory, or disk quotas.
- **Network Egress Filtering:** Strict, allow-list-based outbound network policies have been implemented to prevent data exfiltration and control agent access to external resources.
- **Safety Event Audit Trail:** A detailed, immutable audit trail now logs all safety-driven terminations (quota breaches, network violations) for post-mortem security analysis.

### Distributed Locking
- **Redis & Kubernetes Lease Providers:** To support high-availability, clustered deployments, two new distributed locking providers were implemented based on **Redis** and native **Kubernetes Leases**. This ensures global concurrency policies are respected across multiple orchestrator nodes.

### Persistent Audit Logs
- **Durable Event Store:** The in-memory event and rejection history store has been replaced with a persistent `events.jsonl` file-based store, ensuring that the complete audit trail survives process restarts.
- **Automated Pruning:** A configurable retention policy automatically prunes old event data based on age or total size, effectively managing disk usage.

## 🤖 API & Core Backend

### Orchestration Model Overhaul
- **Directive & Harness Resources:** The core execution model has been refactored. User intent is now captured in a first-class `Directive` resource, and agent configurations are defined in reusable, versioned `HarnessProfile` resources.
- **Orchestrator Migration:** The entire run workflow has been migrated to this new, more structured, and more auditable Directive-Harness pattern.

### LLM & API Connectivity
- **OpenAI-Compatible Provider:** The backend now includes a native adapter for any OpenAI-compatible Chat Completions API, allowing for easy integration with services like OpenAI, Groq, and local models via Ollama.
- **Cursor-Based Pagination:** Unstable offset-based pagination was replaced with a robust, industry-standard cursor-based model for all timeline APIs, ensuring stable pagination under high write load.
- **Server-Authored Timestamps:** API endpoints were hardened to enforce server-side timestamps on critical resources like policies, ensuring data integrity.
- **Run History Retention:** A configurable retention policy was implemented for run history, giving operators control over data growth and storage costs.

## 📈 Fleet Management & Observability

- **Kubernetes Metrics Provider:** The K8s provider was enhanced to report real-time CPU and Memory usage from the cluster's Metrics Server.
- **Run Rejection Auditing:** A new API endpoint (`/api/v1/rejections`) provides a queryable history of all runs that were rejected due to policy violations (e.g., concurrency limits).
- **Fleet Health Metrics:** The Fleet Summary API now includes `uptime` and `errorRate` metrics, which are displayed on the frontend dashboard for at-a-glance fleet reliability assessment.

## ✨ Developer Experience & Refactoring

- **Major API Router Refactor:** The original monolithic API router was completely replaced with a new, metadata-driven `APIRouter`. All routes were migrated to dedicated, self-registering modules, dramatically improving maintainability and introducing deterministic route precedence.
- **Major `runPersona` Orchestrator Refactor:** The complex, monolithic `runPersona` function was broken down into a clean pipeline of discrete, testable functions (`runPreflightChecks`, `constructPrompt`, `executeModelWithRepair`, etc.), making the core logic of the system vastly more readable and maintainable.
- **End-to-End "Self-Review" Test:** A full end-to-end integration test was performed by having Athena run a code review on its own repository, validating the entire toolchain from git integration to model execution to artifact persistence.

## 🌐 Website & Documentation

- **"Mission Control" Design System:** The frontend was overhauled with a new design system based on Tailwind CSS, featuring a "glassmorphism" aesthetic and a high-precision monospace font to create a cohesive, engineered feel.
- **Interactive Homepage Terminal:** A new, interactive terminal component was added to the homepage to demonstrate the core value proposition of the orchestrator in a compelling, simulated CLI session.
- **Docs-as-Code Workflow:** A complete docs-as-code workflow was established, including content templates, QA checklists, a search index generator, and an automated script for synchronizing documentation from the core Athena repository.

## 🐞 Bug Fixes

- Fixed an issue in the API server test suite where an assertion for an error message did not match the actual, more descriptive error returned by the API (`BUG-2026.001`).
- Addressed a layout shift issue on the homepage caused by the interactive terminal component (`03.03-fix-terminal-layout-shift`).
