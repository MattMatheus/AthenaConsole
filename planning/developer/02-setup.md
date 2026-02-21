<!-- AUDIENCE: Internal/Technical -->

# Development Setup

This guide will walk you through setting up your development environment for Project Athena.

## Prerequisites

Ensure you have the following software installed:

*   **Git**: For cloning the repository.
*   **Node.js**: Version 20 or higher. You can download it from [nodejs.org](https://nodejs.org/). We recommend using a version manager like `nvm` (Node Version Manager) to easily switch between Node.js versions.
*   **npm**: Node Package Manager, which comes bundled with Node.js.

## Getting Started

1.  **Clone the Repository:**
    First, clone the Project Athena repository to your local machine:

    ```bash
    git clone <repository-url>
    cd projectathena
    ```

2.  **Install Dependencies:**
    Navigate to the project root directory and install all necessary Node.js dependencies:

    ```bash
    npm install
    ```

3.  **Build the Project:**
    Compile the TypeScript source code into JavaScript. This command will output the compiled files to the `dist/` directory.

    ```bash
    npm run build
    ```

    You can also run a type-check without emitting JavaScript files:

    ```bash
    npm run typecheck
    ```

## Running Tests

Project Athena uses `vitest` for its testing framework.

*   **Run all tests once:**

    ```bash
    npm test
    ```

*   **Run tests in watch mode (for continuous development):**

    ```bash
    npm run test:watch
    ```

## Code Style and Linting

The project uses TypeScript for type safety and implicitly follows standard TypeScript style conventions. There isn't an explicit `lint` script for style checking beyond `tsc --noEmit` which covers type errors.

## Generating API Schemas

Project Athena generates API component schemas from its TypeScript definitions. These schemas are crucial for API contract validation and for generating client libraries.

*   **Generate Schemas:**

    ```bash
    npm run generate:schemas
    ```

*   **Check Schemas (ensure they are up-to-date without regenerating):**

    ```bash
    npm run check:schemas
    ```
    This command is useful in CI/CD pipelines to ensure that developers haven't forgotten to regenerate schemas after making changes to API contracts.
