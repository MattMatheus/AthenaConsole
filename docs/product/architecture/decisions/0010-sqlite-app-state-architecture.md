<!-- AUDIENCE: Internal/Technical -->

# ADR 0010: SQLite App-State Architecture

## Status

Accepted.

## Context

The current implementation uses filesystem-backed state for many runtime and planning concepts. That was useful for early local development, but a web-first console needs queryable, relational, durable app state for tasks, missions, runs, events, artifacts, plugins, agents, schedules, and settings.

The product remains local-first, so the first database should be simple to run locally without infrastructure.

## Decision

Move canonical runtime app state toward SQLite for v1.

Plugin and agent manifests remain filesystem-backed. Team Orchestrator indexes validated plugin manifests, agent manifests, workflow templates, and load errors into SQLite.

Markdown planning remains planning documentation, not app runtime state.

SQLite is a local-first product choice, not a permanent ceiling. If Team Orchestrator evolves into shared or multiplayer deployments, the persistence layer should be revisited.

## SQLite Responsibilities

SQLite should own:

- tasks
- missions
- runs
- run events
- artifact metadata
- plugin index
- agent index
- workflow template index
- schedules
- approvals and safety decisions
- app settings

Filesystem should own:

- plugin source files
- generated artifact file payloads when large or binary
- logs when streaming to files is more practical
- planning documentation

## Scope and Location

The v1 database is per workspace.

The initial database file lives under the existing state directory:

- `.athena/team-orchestrator.sqlite`

Do not rename the state directory as part of this ADR. Naming cleanup can happen later.

## Library and Migrations

Use `better-sqlite3` for the first implementation.

Use hand-written SQL migrations with a small migration runner. Do not add a full ORM initially.

Use a thin repository/data-access layer with prepared SQL. Revisit Kysely, Drizzle, or another query builder only if query complexity justifies it.

## Migration Strategy

Phase 1:

- introduce DB layer and migrations
- add read/write models for plugins, agents, tasks, missions, and runs
- preserve existing filesystem state for current runtime paths
- do not migrate legacy `.athena` session/run files

Phase 2:

- move new console workflows to SQLite
- bridge legacy run/session history read-only where useful

Phase 3:

- retire or archive obsolete filesystem state paths after explicit migration

## Data Access Rules

- Use structured queries and migrations, not ad hoc JSON scanning, for canonical app state.
- Use append-friendly event tables for run timelines.
- Keep canonical run event metadata and timelines in SQLite.
- Keep artifact metadata in SQLite.
- Keep artifact payloads on the filesystem by default to avoid bloating the database.
- Keep schema migrations deterministic and checked into the repo.
- Use WAL mode and route writes through one app service layer where practical.
- Avoid multiple independent writers.

## Consequences

The console can efficiently filter, search, and join tasks, agents, runs, events, and artifacts.

Local-first remains simple: one SQLite database file can represent an app workspace.

Future hosted deployments can move to a managed relational backend without changing the product domain.

## Open Questions

- What exact repository/data-access boundaries should the first implementation use?
- Which tables are needed for the first task/agent/plugin slice?
- What future conditions should trigger a PostgreSQL or hosted database ADR?
