<!-- AUDIENCE: Internal/Technical -->

# Architecture: UI Design & Console Architecture

This document outlines the architectural principles, technology choices, and design patterns for the Team Orchestrator web console.

## Reset Note

The console is now the primary product surface. Future UI work should prioritize tasks, missions, formal agents, plugins, runs, artifacts, events, schedules, and operator safety over fleet-governance dashboards.

## Design Philosophy: "Engineering-First"
The console is designed for solo developers and product operators first. It prioritizes information density, functional clarity, and semantic consistency over decorative aesthetics.

### Key Inspirations
- **Ansible AWX:** For its robust management of job templates and inventory.
- **Apache Airflow:** For its clear visualization of DAGs and execution history.
- **VS Code:** For its use of sidebars, collapsible activity bars, and dense tree views.

## Technology Stack
- **Framework:** React 18+ (TypeScript) for component-driven development.
- **Build Tool:** Vite for near-instant HMR and optimized production builds.
- **Styling:** Vanilla CSS + CSS Modules.
  - **Why:** Avoids the abstraction overhead of utility-first frameworks (Tailwind) and ensures absolute control over the dense, industrial aesthetic.
- **State Management:**
  - **Server State:** TanStack Query (React Query) for caching, synchronization, and optimistic updates.
  - **UI State:** Native React Context/State for low-frequency interactions (e.g., sidebar toggle).
- **Routing:** React Router v6.

## Layout & Navigation Patterns
The console follows a "Shell & Pane" model designed to maximize screen real estate for complex data.

### 1. Persistent Navigation (The Sidebar)
- **Position:** Left side.
- **Behavior:** Toggleable via a global "Hamburger" menu in the header.
- **State:** Sidebar visibility is persisted in `localStorage`.
- **Content:** Primary links should evolve toward Tasks, Missions, Agents, Plugins, Runs, Schedules, and Settings.

### 2. The Header
- **Breadcrumbs:** Dynamic path showing current location (e.g., `Sessions > d8b2... > Transcript`).
- **Global Search:** Fast-access search bar for Task IDs, Mission IDs, Run IDs, Agent IDs, and artifact names.
- **Context:** Displays active RBAC identity and enforcement mode (Observe/Enforce).

### 3. Central Detail Pane (The Workbench)
- **Accordions:** Dense metadata (run configurations, resource usage, environment variables) must be placed in collapsible sections.
- **Monospace Priority:** IDs, JSON payloads, and log fragments must use monospaced fonts (e.g., `JetBrains Mono` or `Roboto Mono`).
- **Streaming Transcripts:** Real-time updates utilize CSS-driven "pulse" or "typing" indicators to signify agent activity without layout shift.

## Design Tokens (The "Industrial" Palette)
- **Primary:** High-contrast neutral scales (Dark Grays/Whites).
- **Accents:** Semantic colors for status:
  - **Success:** Emerald Green (Run Completed).
  - **Warning:** Amber (Safety Violation / Quota Warning).
  - **Error:** Ruby Red (Run Failed / Egress Blocked).
  - **Active:** Cobalt Blue (In Progress).

## Component Standards
- **Composition over Inheritance:** Build small, reusable atoms (Button, Card, Badge) and compose them into domain features.
- **Fail-Closed UI:** If an API call fails or permission is denied, the UI must explicitly render an "Unauthorized" or "Data Unavailable" state rather than an empty screen.
- **No Mystery Meat:** Icons must have tooltips or labels; navigation must be unambiguous.
