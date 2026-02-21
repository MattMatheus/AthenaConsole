# Project Athena Source Code (`src/`)

This directory contains the core implementation of Project Athena.

## 🏗️ Architecture Overview

Athena is built as an API-first control plane with modular runtime components.

- `cli/`: Command-line interface logic (acts as an API client).
- `control-plane/`: Centralized services, API contracts, and schema definitions.
- `runtime/`: Core execution logic for agent sessions and turns.
- `work/`: Per-session work queue management and persistence.
- `memory/`: Session history and retrievable (RAG) memory systems.
- `context/`: Context compilation, budgeting, and overflow handling.
- `providers/`: Abstraction layer for LLM model providers.
- `personas/`: Persona orchestration and specialist loading/runtime logic.
- `schedule/`: System-level task scheduling and logging.
- `shared/`: Canonical DTO contracts and common utilities.
- `tools/`: Built-in capabilities available to agents.

## 📖 Recommended Reading Order

1. `shared/contracts.ts`: Understand the domain model.
2. `control-plane/services.ts`: See how business logic is orchestrated.
3. `runtime/index.ts`: The heart of the execution loop.

*For detailed architectural explanations, refer to `docs/developer/01-architecture.md`.*
