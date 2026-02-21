<!-- AUDIENCE: Internal/Technical -->

# Contributing Guide

We welcome contributions to Project Athena! This guide outlines the process for contributing new features, bug fixes, and improvements.

## General Principles

*   **API-First Mindset:** When designing new features, always consider how they will integrate with the Control Plane API. New CLI functionality should ideally be a client to a new or existing API endpoint.
*   **Modularity:** Adhere to the existing module structure. New functionality should be placed in the most appropriate `src/` subdirectory or a new one if a clear separation of concerns demands it.
*   **Test-Driven Development:** Write tests for new features and bug fixes. Ensure that existing tests pass and that your new tests cover the intended functionality thoroughly.
*   **TypeScript:** All new code should be written in TypeScript, leveraging its type safety features.

## Contribution Workflow

1.  **Fork the Repository:** Start by forking the Project Athena repository on GitHub.
2.  **Create a New Branch:** Create a new branch from `main` for your feature or bug fix. Use a descriptive name (e.g., `feature/add-new-provider`, `bugfix/fix-memory-leak`).
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Implement Your Changes:**
    *   Write your code, following the architectural guidelines.
    *   Add or update tests to cover your changes.
    *   Ensure that all existing tests pass (`npm test`).
    *   If you're modifying API contracts, remember to regenerate the schemas: `npm run generate:schemas`.
    *   Make sure your code compiles without errors (`npm run build`).
4.  **Commit Your Changes:** Write clear, concise commit messages. Reference any relevant issues.
5.  **Push Your Branch:** Push your changes to your forked repository.
    ```bash
    git push origin feature/your-feature-name
    ```
6.  **Create a Pull Request (PR):** Open a pull request against the `main` branch of the upstream Project Athena repository.
    *   Provide a clear title and description for your PR, explaining the changes and their motivation.
    *   Ensure all CI checks (tests, schema checks, build) pass.
    *   Be responsive to feedback during the review process.

## Adding New API Endpoints

When adding new API endpoints:

1.  **Define Contracts:** Update the relevant TypeScript interfaces in `src/control-plane/api-contracts.ts` to define the request and response DTOs (Data Transfer Objects).
2.  **Implement Service Logic:** Create or extend services in `src/control-plane/services.ts` (or a new service file) to implement the business logic for your endpoint.
3.  **Register Route Through Route Modules:** Add the route handler in the appropriate route module under `src/api/routes/` and register it with `defineApiRoutes()` from `src/api/routes/route-registration.ts`.
    *   Include the correct route family metadata via `defineApiRoutes("<family>", [...])`.
    *   Avoid manual metadata remapping in `src/api/server.ts`.
    *   If adding a new family-level module, compose it into the global table with `composeApiRouteTable(...)` in `src/api/server.ts`.
4.  **Generate Schemas:** Run `npm run generate:schemas` to update the API component schemas.
5.  **Add Tests:** Write API integration tests in `tests/api.*.test.ts` to ensure your endpoint functions correctly.

## Testing Philosophy

Project Athena emphasizes robust testing to ensure reliability and maintainability.

*   **Unit Tests:** For individual functions and small components.
*   **Integration Tests:** For modules interacting with each other, especially API endpoints and core runtime flows.
*   **End-to-End Tests:** Covering critical user flows, including scenarios with restarts and crashes, to validate recovery behavior.
