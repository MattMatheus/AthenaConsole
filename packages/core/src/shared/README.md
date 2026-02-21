# Shared (`src/shared/`)

This directory contains code and definitions shared across all modules of Project Athena.

## 💎 Canonical Contracts (`contracts.ts`)

This file is the **Source of Truth** for all Data Transfer Objects (DTOs) used in the system. 
- **DO NOT** duplicate these interfaces elsewhere.
- **DO** re-export these from `src/control-plane/api-contracts.ts` for use in the API layer.

## Utilities

Contains shared helpers, constants, and type guards used throughout the codebase.

*Changes here often require a schema regeneration. See `src/control-plane/README.md`.*
