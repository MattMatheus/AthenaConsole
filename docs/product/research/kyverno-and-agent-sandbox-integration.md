<!-- AUDIENCE: Internal/Technical -->

# Kyverno And Agent Sandbox Integration Brief

## Status

Research / proposal. Not scheduled.

## Overview

Team Orchestrator is maturing from a strong local runtime into an agent platform with clearer safety boundaries. Integrating Agent Sandbox and Kyverno would close a key gap for safe execution at scale with enforceable governance.

## Why This Matters

- **Reduce operational risk**: AI agents can execute untrusted or unpredictable actions. Isolation and policy enforcement reduce blast radius.
- **Improve trust for enterprise adoption**: Governance moves from "best effort in prompts" to hard controls at infrastructure and admission layers.
- **Preserve speed while adding safety**: Agent Sandbox warm pools improve startup time for isolated workloads, avoiding major latency penalties.
- **Support role-based controls**: Different agent roles (audit vs build) can run under different guardrails without changing agent prompts.

## What Each Component Contributes

- **Agent Sandbox**: Provides fast, isolated runtime environments for agent work.
- **Kyverno**: Enforces policy-as-code so workloads that violate security rules are blocked or auto-corrected before running.
- **Team Orchestrator Control Plane**: Remains the orchestration brain, deciding intent, tracking runs, and exposing audit/telemetry.

## How It Works

1. Team Orchestrator receives a run request.
2. Team Orchestrator requests an isolated execution environment from Agent Sandbox.
3. Kyverno checks and enforces required policies for that agent role.
4. If compliant, the run executes; if not, it is rejected with an auditable reason.
5. Team Orchestrator captures outcomes, telemetry, and cleanup status for operations and compliance.

## Business Outcomes

- Faster security reviews for new agent use cases.
- Lower incident likelihood and impact.
- Clear audit trail for policy decisions.
- Better path to multi-team and regulated-environment deployment.

## Recommended Rollout

1. **Pilot**: Enable for one high-risk agent role with strict policies.
2. **Measure**: Track startup latency, policy rejection rates, run success, and operator toil.
3. **Expand**: Add role-based profiles and runtime options for broader workloads.
4. **Standardize**: Make policy-backed isolated execution the default for sensitive tasks.

## Decision Framing

This is not replacing Team Orchestrator's core value. It strengthens the control-plane model with proven infrastructure and governance layers, making the platform safer, more credible, and more scalable for enterprise operations.
