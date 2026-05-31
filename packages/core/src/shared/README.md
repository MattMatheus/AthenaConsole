# Shared (`src/shared/`)

This directory contains code and definitions shared across Team Orchestrator core modules.

## 💎 Canonical Contracts (`contracts.ts`)

This file is the **Source of Truth** for core runtime and API Data Transfer Objects (DTOs).
- **DO NOT** duplicate these interfaces elsewhere inside `@athena/core`.
- **DO** re-export these from `src/control-plane/api-contracts.ts` for use in the API layer.

## Utilities

Contains shared helpers, constants, and type guards used throughout the codebase.

*Changes here often require a schema regeneration. See `src/control-plane/README.md`.*
