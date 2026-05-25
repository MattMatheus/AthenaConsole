<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Flight Path (Roadmap)

This roadmap outlines the trajectory for Team Orchestrator, moving from core infrastructure to a fully governed, multi-specialist mission control plane.

## Phase 1: Mission Foundation (Stages 1-8) — *Complete*
Focus: Building the core "Glass Cockpit" and the orchestration backend.
- [x] **Athena Core:** Strategic intent interpreter and basic planning logic.
- [x] **The Hangar (Foundation):** Basic registry and secure sandboxing/provisioning.
- [x] **Mission Relay:** Context compounding and A2A (Agent-to-Agent) knowledge transfer.
- [x] **Command Bridge:** Initial Dashboard HUD for mission observability.
- [x] **CLI Uplink:** Stabilizing `athena run` and `.athena/` state management.

## Phase 2: Tactical Specialization (Stages 9-12) — *Current*
Focus: Shifting from generic agents to the **Manifest & Specialist** model.
- [ ] **Manifest Engine:** Athena-driven assembly of specialist units for specific objectives (e.g., Hotfix, Feature Launch).
- [ ] **Core Specialist Roster:** Formalizing "Designations" with distinct toolsets and KPIs.
    - *Reliability Specialist* (SRE/Performance)
    - *Bug Scrubber* (Debugging/Patching)
    - *Security Auditor* (Governance/Compliance)
- [ ] **The Academy (Beta):** Initial implementation of the "Fidelity Rating" and pilot calibration loops.
- [x] **Evidence Bundling:** Automating the collection of logs, benchmarks, and PRs into a single "Mission Briefing." (Delivered in Release 001)

## Phase 3: Fleet Operations (Stages 13-16)
Focus: Scaling the mission control for enterprise-grade complexity.
- [ ] **Multi-Unit Scaling:** Managing multiple concurrent manifests across different project namespaces.
- [ ] **Active Bridge (V2):** Real-time collaborative sessions with specialists for high-stakes incidents.
- [/] **Custom PDK (Pilot Development Kit):** Initial version delivered in Release 001; V2 will enable full "Commissioning" and "Training" in The Hangar.
- [ ] **Policy-Aware Execution:** Natural language policy enforcement for all specialists in the manifest.

## Phase 4: Autonomous Governance (Stages 17-20)
Focus: Total industrial-grade control and self-optimization.
- [ ] **Enterprise Fleet Analytics:** Cost optimization, token efficiency, and unit performance modeling across the entire org.
- [ ] **Self-Bootstrap Loop:** Athena orchestrating the platform's own development cycle.
- [ ] **Mission Insurance:** Fidelity-backed guarantees for specialist output quality.

---
**Strategy References:**
- [Identity & Essence](./Strategy/IDENTITY.md)
- [Manifest Samples](./Strategy/MANIFEST_SAMPLES.md)
- [Performance & Calibration](./Strategy/PERFORMANCE_MODEL.md)
