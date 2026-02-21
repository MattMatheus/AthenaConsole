---
title: Mission Run Endpoint
description: API contract for mission execution requests.
---

## Request payload

Clients submit mission intent and execution constraints. Athena interprets the intent to propose a **Flight Manifest**.

- `intent`: High-level mission objective (e.g., "Hotfix critical leak").
- `constraints`: Execution boundaries, sandboxing requirements, and specialist designations.

## Response envelope

Responses include mission status, the active **Flight Manifest**, and **Evidence Bundle** metadata.

- `missionId`: Unique identifier for the mission trace.
- `manifest`: The curated list of specialists and relay paths.
- `evidencePath`: Reference to the archived Evidence Bundle in `.athena/evidence/`.
- `status`: Mission lifecycle state (PENDING, SUCCESS, FAILURE).
