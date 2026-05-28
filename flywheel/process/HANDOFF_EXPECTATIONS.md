# Handoff Expectations

Each stage handoff should contain:
- what changed
- why it changed
- validation or review evidence
- open risks
- assumptions carried forward
- action or approval notes when risky work occurred
- next-state recommendation
- state transition path when backlog state changed

Handoffs should be concise and sufficient for the next stage to proceed without rediscovering context.

Engineering items moving to QA should fill `## Engineering Handoff`. Engineering items moving to done should also fill `## QA Verdict`.

Architecture items moving to architecture QA or done should fill `## Architecture Handoff`.

If the optional artifact workflow integration is enabled, a stage may also emit a durable manifest that points at the handoff inputs instead of relying only on raw path references in prose.

When backlog state changes, prefer recording it through `flywheel/tools/flywheel_state.sh move ...` so transition history is preserved with the item.
