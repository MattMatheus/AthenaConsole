# Team Orchestrator: Operational Workflow & Swarm Coordination

## 1. The Collaborative Loop
The Flight Director (FD) and Athena work in a continuous feedback loop to manage the mission lifecycle.

### Phase 1: Objective Interpretation
- **FD:** Inputs a high-level goal (e.g., "We need to refactor the authentication module").
- **Athena:** Analyzes the request against the existing context. She suggests a mission path and recommends specialists from the unit (e.g., "Recommended: Sarah for requirements update, followed by Leo for implementation").

### Phase 2: Unit Deployment
- **FD:** Approves or modifies the recommendation (e.g., "Skip Sarah, I'll provide the requirements. Send the brief to Leo").
- **Athena:** Provisions the sandbox, distill the context, and initiates the mission for the selected specialist.

## 2. The Mission Relay (A2A Coordination)
Athena acts as the "Briefing Officer" for the entire unit, ensuring perfect knowledge transfer between specialists.

- **Context Compounding:** When a specialist (like Sarah) completes a task, Athena ingests the output, distill its essence, and prepares the "Seed Context" for the next agent in the chain.
- **Swarm Integrity:** Athena monitors the status of all active agents in the swarm, preventing resource contention and ensuring policy compliance.

## 3. The Specialist Registry (The Hangar)
A hybrid "App Store" and "Recruitment Center" where engineers onboard new agents to their units.

- **The Specialist Dossier:** Detailed profile for each agent (Technical specs + Persona specs).
- **Unit Assignment:** "Athena, onboard Maya (Data Scientist) to the 'Core-Infra' unit."

## 4. Managed Autonomy & Interventions
- **Athena's Autonomy:** She can manage multi-step DAGs independently once the FD sets the trajectory.
- **Human Intervention:** The FD can "Break the Loop" at any point. They can talk to Athena to change a specialist's direction, update a policy mid-mission, or veto an agent's output.
- **Lore-Friendly Controls:** `athena run` is the command to initiate the collaborative uplink.
