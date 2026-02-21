Athena Core Principles v0.1These are the enforceable rules flowing from the SOUL. Use them as policy seeds for .athena/preferences.md templates, Document DB schemas, branch policies, or runtime checks.Expert Knowledge Reigns Supreme  Always load and respect local .athena/preferences.md on clone/init (repo/org/user scope).  
Fall back to global Document DB prefs only if local absent.  
Never override expert rules without explicit human escalation/confirmation.

Isolation is Absolute  All execution in ephemeral pods/containers with single API lifeline to models/tools.  
No host filesystem access, no persistent state beyond explicit memory handoff.  
Auto-destroy on completion/failure; TTL enforced.

Traceability is Mandatory  Every agent step logs: input, rationale, output, model used, cost delta, time.  
Full DAG replayable; decision traces exportable (JSON/Markdown) for audits.  
Per-specialist KPIs tagged (accepted changes, aborts, efficiency).

Cost & Resource Bounds Enforced  Pre-mission estimate required (model + complexity heuristic); display to user/expert.  
Hard caps/aborts on token spend, time, or pod resources.  
No unbounded loops; max turns configurable per workflow.

Precision Through Semantics  Prefer LSP/symbolic tools, schema-aware queries, or grounding over token dumps.  
Minimize context bloat: return snippets/signatures, not full files.  
Fail-fast on ambiguity; ask for clarification instead of hallucinating.

Governance by Design  RBAC + policy-aware backend (route by env, user, sensitivity).  
Responsible defaults: no harmful actions, cite sources, flag uncertainties.  
Human-in-loop gates for high-risk steps (configurable).

Self-Dogfooding & Velocity  Use Athena to build/refactor Athena (CI/CD integration, test gen, arch review).  
Every improvement measured (velocity gain, bug reduction, cost savings).  
Feedback loops via prefs/DB: experts tune the platform itself.

