# Jira Or Linear Connector Decision

Decision: implement Jira first; defer Linear.

## Comparison

| Criterion | Jira | Linear |
| --- | --- | --- |
| Org fit | Common enterprise default, strong governance expectation. | Strong product/dev UX, less universal in enterprise environments. |
| Auth complexity | API token and OAuth paths are familiar; cloud and data-center variants add scope risk. | OAuth is clean, API is modern, but workspace install flow is product-specific. |
| API stability | Mature REST API with many fixtures and examples. | Stable GraphQL API, but schema-driven fixture setup is a little heavier. |
| Fixtureability | Easy to fixture issue reads, comments, transitions, and search responses. | Easy reads, but workflow/status semantics are more Linear-specific. |
| Scope risk | Broad surface; v1 must be read-only issue context. | Narrower model; lower implementation surface. |
| Workflow value | Highest chance of matching existing internal issue workflows. | Excellent if the org already standardizes on Linear. |

## V1 Scope

- Read-only issue lookup/search.
- Credential binding by secret reference.
- Scope readiness for issue read permissions.
- Connector action audit events with redacted request metadata.
- One workflow that combines issue context with a software-team agent.

## Deferred

- Jira write actions, transitions, comments, and project administration.
- Linear connector until a team explicitly needs Linear-backed workflows.
