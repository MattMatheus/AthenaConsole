<!-- AUDIENCE: Operator -->

# Team Orchestrator User Manual

Team Orchestrator is a work control plane for teams and operators. Deploy it as a local workbench for one operator, or as a trusted server for a team with workspace membership, RBAC, cost governance, and audit-ready run history.

This manual covers operator and admin workflows: deploying the server, managing workspaces, running work, inspecting results, and administering the platform. For agent authoring and API integration, see the [SDK and Integration Guide](../sdk/README.md).

---

## Manual Pages

| # | Page | Contents |
|---|------|----------|
| 01 | [Overview](01-overview.md) | What Team Orchestrator does; product model reference (tasks, missions, runs, agents, plugins, workflows, events, artifacts, providers, repositories, safety controls) |
| 02 | [Install and Deploy](02-install-and-deploy.md) | Prerequisites; local stack; trusted-server and production profiles; environment variables; health and readiness |
| 03 | [Workspaces and Multiplayer](03-workspaces-and-multiplayer.md) | Workspace creation and management; multi-user operation; what is available today vs. what is in preview |
| 04 | [Roles and RBAC](04-roles-and-rbac.md) | Roles (Admin, Operator, Viewer); permission boundaries; workspace-scoped access |
| 05 | [Running Work](05-running-work.md) | Start Work flow; capabilities; preflight; task and workflow execution; first-run demo; product smoke; inspecting results |
| 06 | [Providers, Memory, and Repositories](06-providers-memory-repos.md) | Configuring model providers; memory backends; repository context and wiring |
| 07 | [Cost Governance](07-cost-governance.md) | Budgets, usage ledger, quotas; cost enforcement status |
| 08 | [Operations and Admin](08-operations-and-admin.md) | Server administration; health and readiness; plugin management; events, artifacts, evidence; diagnostics; smoke suite |
| 09 | [Troubleshooting](09-troubleshooting.md) | Common errors; readiness failures; provider issues; plugin validation |
| 10 | [Glossary](10-glossary.md) | Canonical definitions for product vocabulary |

---

## Who This Is For

This manual is for:

- operators running agent work against repositories or shared infrastructure,
- admins deploying and configuring the server for a team,
- evaluators reviewing what is built, what is in preview, and what to expect.

If you only want the shortest startup path, use [GETTING_STARTED.md](../../GETTING_STARTED.md) at the repo root. Come back here when you want to understand what each step means.

For agent authoring, capability pack development, and the HTTP API reference, see the [SDK and Integration Guide](../sdk/README.md).

---

## Preview Status

Some multi-user capabilities are designed but not yet enforced. Every section that describes an unbuilt or partially-enforced capability carries the preview banner from [docs/conventions.md](../conventions.md). Read those banners before deploying to untrusted users.
