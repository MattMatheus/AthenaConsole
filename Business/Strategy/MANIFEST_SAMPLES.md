# Team Orchestrator: Standardized Flight Manifests

These templates demonstrate how Athena interprets high-level objectives into specific specialist units and mission relays.

## 1. Scenario: The "Hotfix" Manifest
**Objective:** "Fix the critical memory leak in the Auth service."

### The Manifest
- **1x Bug Scrubber:** Analyzes heap dumps, identifies the leak source, and proposes a surgical fix.
- **1x Reliability Specialist:** Validates the fix against performance benchmarks and ensures no regression in system stability.
- **1x Security Auditor:** Verifies that the patch does not introduce new vulnerabilities in the Auth flow.

### The Relay Path
1. **Interpretation:** Athena identifies the leak and identifies the Auth service dependencies.
2. **Execution:** Bug Scrubber operates in a dedicated sandbox with access to logs and heap dumps.
3. **Verification:** Output is relayed to the Reliability Specialist for stress testing.
4. **Final Audit:** Security Auditor signs off on the patch integrity.
5. **Briefing:** The Flight Director receives the "Evidence Bundle" (Logs + Benchmark delta + Security sign-off).

---

## 2. Scenario: The "Feature Launch" Manifest
**Objective:** "Implement and deploy the new 'Usage Billing' module."

### The Manifest
- **1x Strategic Architect:** Interprets requirements, defines the database schema, and creates the implementation roadmap.
- **2x Systems Engineers:** Execute the code implementation across the API and worker layers.
- **1x Verification Officer (Alex):** Conducts end-to-end integration testing and ensures billing accuracy.

### The Relay Path
1. **Interpretation:** Athena maps the billing logic to existing infrastructure.
2. **Execution:** Strategic Architect creates the blueprint; Systems Engineers build the components in parallel pods.
3. **Relay:** Athena compounding the "Seed Context" as each component is completed.
4. **Verification:** Integration suite is run by the Verification Officer.
5. **Briefing:** Flight Director receives the "Mission Summary" with PR links and test coverage reports.

---

## 3. Scenario: The "Security Hardening" Manifest
**Objective:** "Harden the public API against OWASP Top 10 vulnerabilities."

### The Manifest
- **2x Security Auditors:** Conduct automated penetration testing and manual-style policy audits.
- **1x Reliability Specialist:** Monitors for any performance overhead introduced by new security middleware.
- **1x Bug Scrubber:** Patches identified vulnerabilities in real-time as they are discovered.

### The Relay Path
1. **Interpretation:** Athena scans the API surface area and identifies high-risk endpoints.
2. **Execution:** Security Auditors initiate a "Red Team" mission in a mirrored production environment.
3. **Action:** Vulnerabilities are relayed to the Bug Scrubber for immediate remediation.
4. **Monitoring:** Reliability Specialist ensures that latency remains within policy limits.
5. **Briefing:** Flight Director receives a "Compliance Certificate" and a detailed audit log of all patches.
