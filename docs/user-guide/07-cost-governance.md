<!-- AUDIENCE: Admin/Enterprise -->

# Cost Governance

> **Status**: Partially implemented. See the preview banner below for unbuilt enforcement controls.

Cost budget enforcement is not yet active: `costBudgetDailyUsd` is parsed and stored in the policy contract (`packages/core/src/shared/contracts/policy.ts:70`) but is never evaluated against actual usage during run execution. Tracking: epic 2026.45.

---

## Available Today

### Usage Ledger

Team Orchestrator records usage events for model-backed runs. The usage ledger provides visibility into what was consumed without enforcing limits.

Access usage records:

```bash
curl http://127.0.0.1:8787/api/v1/usage
```

Usage records include provider, model, token counts, and estimated cost where the provider returns that information.

### Cost Configuration Field

The policy contract accepts a `costBudgetDailyUsd` field:

```json
{
  "costBudgetDailyUsd": 10.00
}
```

This value is parsed and stored but does **not** currently gate run execution. Storing the budget now allows agents and dashboards to display budget vs. usage comparisons even before enforcement lands.

To set the policy (Admin only):

```bash
curl -X PUT http://127.0.0.1:8787/api/v1/policy \
  -H "content-type: application/json" \
  -d '{"costBudgetDailyUsd": 10.00}'
```

Get the current policy:

```bash
curl http://127.0.0.1:8787/api/v1/policy
```

---

## Target Behavior (In Preview)

The following capabilities are designed but not yet built (epic 2026.45):

### Per-Workspace Budget Enforcement

Target: when a workspace's `costBudgetDailyUsd` is exceeded, new runs in that workspace are blocked until the daily window resets. As of this build, no enforcement check runs during task or workflow execution.

### Cross-User Budget Accounting

Target: usage is attributed per user per workspace, and budget limits are evaluated against per-user or per-workspace totals. As of this build, usage is recorded but not attributed in a way that supports per-workspace enforcement.

### Quota Alerts

Target: alerts or events fire when usage approaches or exceeds budget thresholds. As of this build, no alerting mechanism exists.

---

## Practical Guidance

Until enforcement lands:

- Use the usage ledger (`/api/v1/usage`) to monitor provider consumption manually.
- Set `costBudgetDailyUsd` in the policy to document your intended limit — this will be read when enforcement is implemented.
- Limit access to model-backed agents by restricting which users have Operator or Admin role in the deployment.

---

## Next Steps

- [Roles and RBAC](04-roles-and-rbac.md) — gate access to model-backed work by role
- [Operations and Admin](08-operations-and-admin.md) — policy management and concurrency limits
