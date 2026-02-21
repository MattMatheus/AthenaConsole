# Control Plane (`src/control-plane/`)

The Control Plane is the central orchestration layer of Project Athena. It exposes the core functionality via a REST API and ensures consistent behavior across all interfaces (CLI, API, etc.).

## Key Components

- **Services (`services.ts`)**: The primary implementation of business logic. These services are used by both the API router and the internal runtime logic.
- **API Contracts (`api-contracts.ts`)**: Defines the HTTP interface, including routes, query parameters, and error types.
- **Schemas (`api-schemas.ts` & `generated-component-schemas.ts`)**: Runtime validation rules for API requests and responses.
- **State Store (`state-store.ts`)**: Manages the persistence of system-wide state.

## ⚠️ Important: Contract Workflow

When modifying shared DTOs in `src/shared/contracts.ts`, you **must** update the schemas here:

1. Edit `src/shared/contracts.ts`.
2. Run `npm run generate:schemas`.
3. Verify with `npm run check:schemas`.

*See `docs/developer/01-architecture.md` for more details on the API-first design.*
