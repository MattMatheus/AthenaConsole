---
title: Getting Started
description: Orientation to the Team Orchestrator command model and operating philosophy.
sidebar:
  order: 1
---

## The Command Chain

Team Orchestrator does not just "run agents"—it governs them. Our architecture is built on a tiered command structure designed for absolute situational awareness:

1. **Flight Director** (The Human): Sets mission intent, validates flight manifests, and holds the final override key.
2. **Athena** (The Orchestrator): Translates strategic intent into **Flight Manifests** and manages the lifecycle of specialists.
3. **Specialist Roster** (The Agents): High-fidelity technical designations (e.g., **Bug Scrubber**, **Reliability Specialist**) executing scoped, deterministic tasks within governed sandboxes.

## Operating Philosophy

We believe in **Managed Autonomy**. This means shifting away from "black-box" autopilot systems toward a model where every action is observable, auditable, and steerable.

1. **Submit Objective:** Launch a mission by defining a clear business requirement (e.g., "Hotfix").
2. **Review Flight Manifest:** Athena proposes a **curated manifest** of specialist units and a context-compounding relay path.
3. **Validate & Launch:** Approve the manifest. Athena briefs the specialists and initiates execution.
4. **Mission Briefing:** Receive the final **Evidence Bundle** and strategic summary for verification.

## Interface Standards

Access the command surface through our native instrumentation:

- **CLI:** `athena run` — The primary mission deployment interface.
- **Mission Run API:** `POST /api/v1/mission/run` — Orchestrate specialist teams programmatically.
- **State Directory:** `.athena/` — Local mission context and telemetry storage.
- **Real-time Observability:** Athena now emits lifecycle audit events for every mission phase.

## Security Boundary

- **Identity Header:** `X-Athena-Identity` — The security boundary for cross-agent trust and workload isolation.
