Seed Prompt 1: The Monorepo "Fleet" Scaffold
  Objective: Transition the current fragmented structure into a unified Turborepo monorepo.


  > Mission Briefing: Initialize a Turborepo-managed monorepo for the "Athena Fleet."
  >
  > Structure:
  > - Move projectathena/src and its core logic into packages/core.
  > - Move projectathena/packages/console to apps/console.
  > - Move projectathena/packages/pdk to packages/pdk.
  > - Create apps/api using the existing API logic from projectathena.
  > - Move the teamorchestrator.com (Astro) repo into apps/marketing.
  >
  > Technical Requirements:
  > 1. Setup turbo.json with pipeline tasks for build, test, lint, and typecheck.
  > 2. Implement Workspace-wide TypeScript references.
  > 3. Consolidate root-level package.json scripts to orchestrate the entire fleet.
  > 4. Ensure the athena CLI bin is correctly linked from packages/core to the root for local development.

  ---


  Seed Prompt 2: "The Hangar" Specialist Elevation
  Objective: Formalize "The Hangar" as a top-level directory for Specialist Designations.


  > Mission Briefing: Refactor the "Specialist" (Persona) management system to align with the Phase 2 Roadmap.
  >
  > Actions:
  > - Extract all personas from packages/core/personas and move them to a root-level specialists/ directory.
  > - Standardize each Specialist (e.g., Bug Scrubber, Security Auditor) into its own folder containing:
  >   - manifest.json: Defining capabilities and toolsets.
  >   - prompt.md: The system instructions.
  >   - tests/: Specialist-specific validation logic.
  > - Update the PDK (Pilot Development Kit) to support this new external structure.
  > - Modify the core runtime to load specialists from this new specialists/ path rather than internal source code.

  ---


  Seed Prompt 3: The "Glass Cockpit" Design System
  Objective: Create a shared UI library to bridge the Marketing site and the Console.


  > Mission Briefing: Establish packages/ui-shared to enforce the "Glass Cockpit" visual identity across the Fleet.
  >
  > Actions:
  > - Create packages/ui-shared using React and Vanilla CSS (per project standards).
  > - Extract core visual components from apps/console (e.g., Mission Telemetry, Status Indicators, HUD elements).
  > - Configure the Astro-based apps/marketing to consume these React components for high-fidelity demos.
  > - Setup a shared Tailwind/CSS configuration that ensures "Deep Trust Blue" and "Slate Grey" palettes are consistent across athena.teamorchestrator.com and the main site.
  > - Add a "Login" bridge in the Marketing app that points to the Console's authentication route.

  ---


  Final Operational Note: Once you have moved the Business docs to the ADO Wiki, we can create a fourth prompt to setup a "Strategy Sync" script that pulls Wiki updates into a local
  .athena/strategy cache, allowing Athena to stay context-aware of your business goals during execution.