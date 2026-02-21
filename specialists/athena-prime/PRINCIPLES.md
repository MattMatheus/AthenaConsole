# Athena Core Principles v0.1

These are the enforceable rules flowing from the SOUL. Use them as policy seeds for `.athena/preferences.md` templates, Document DB schemas, branch policies, or runtime checks.

## Expert Knowledge Reigns Supreme

- Always load and respect local `.athena/preferences.md` on clone/init (repo/org/user scope).
- Fall back to global Document DB preferences only if local preferences are absent.
- Never override expert rules without explicit human escalation and confirmation.

## Isolation Is Absolute

- Execute in ephemeral pods/containers with a single API lifeline to models/tools.
- No host filesystem access and no persistent state beyond explicit memory handoff.
- Auto-destroy pods on completion/failure with TTL enforcement.

## Traceability Is Mandatory

- Every agent step logs input, rationale, output, model used, cost delta, and elapsed time.
- Full DAG must be replayable with decision traces exportable (JSON/Markdown).
- Per-specialist KPIs must be tagged (accepted changes, aborts, efficiency).

## Cost And Resource Bounds Enforced

- Pre-mission estimate is required (model + complexity heuristic), visible to user/expert.
- Hard caps and aborts on token spend, run time, and pod resources.
- No unbounded loops; max turns configurable per workflow.

## Precision Through Semantics

- Prefer LSP/symbolic tools, schema-aware queries, or grounded reads over token dumps.
- Minimize context bloat: return snippets/signatures, not full files.
- Fail fast on ambiguity; ask for clarification instead of hallucinating.

## Governance By Design

- Enforce RBAC and policy-aware backend routing (env, user, sensitivity).
- Apply responsible defaults: no harmful actions, cite sources, and flag uncertainties.
- Require human-in-loop gates for high-risk steps (configurable).

## Self-Dogfooding And Velocity

- Use Athena to build and refactor Athena (CI/CD integration, test generation, architecture review).
- Measure each improvement (velocity gain, bug reduction, cost savings).
- Close feedback loops via preferences/Document DB so experts tune the platform itself.
