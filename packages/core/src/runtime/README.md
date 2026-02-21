# Runtime (`src/runtime/`)

The `runtime` module manages the execution lifecycle of agent turns.

## Core Responsibilities

- **Session Lifecycle**: Creating and loading sessions.
- **Turn Execution**: Coordinating context assembly, provider calls, and result persistence.
- **Locking**: Ensuring atomic access to session state using file-based locks (`session-lock.ts`).
- **History**: Managing the timeline of turns (`history.ts`).
- **Cancellation**: Handling timeouts and user-initiated aborts (`cancellation.ts`).

## Main Entry Point

The `run` function in `index.ts` (or the `Runtime` class) is the primary engine for executing agent logic.

*Refer to `docs/developer/01-architecture.md` for a deep dive into the runtime loop.*
