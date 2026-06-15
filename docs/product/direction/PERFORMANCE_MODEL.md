<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Run Quality Model

## Purpose

Run quality should measure whether an agent did useful work safely, inspectably, and within reasonable resource bounds.

This replaces the older fidelity/pilot calibration framing with practical operator metrics.

## Runtime Metrics

- run duration
- status: completed, failed, cancelled, stopped by limit
- retry count
- cancellation latency
- backend type: local process, container, API, module, LangGraph, DAG
- resource hints where available

## Agent Behavior Metrics

- tool-call count
- loop-limit stops
- repeated-action detection
- validation failures
- risky action requests
- approval requests and outcomes
- follow-up tasks proposed

## Output Quality Signals

- artifact count and type
- required output presence
- optional schema validation result
- operator accepted/rejected/retried
- follow-up task conversion rate

## Inspectability Signals

- event coverage
- log availability
- artifact availability
- internal step visibility for inspectable agents
- black-box wrapper status for agents without internal hooks

## Cost Signals

- token usage where available
- API/backend cost estimate where available
- local/container runtime duration

Cost visibility matters. Enterprise cost governance — budgets, caps, alerts, and per-workspace usage reporting — is in scope for the current enterprise readiness arc (2026.45).
