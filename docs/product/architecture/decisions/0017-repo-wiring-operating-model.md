<!-- AUDIENCE: Internal/Technical -->

# ADR 0017: Repo Wiring Operating Model

## Status

Accepted.

## Context

Operators need a clear way to understand how Team Orchestrator connects to real local work. The console does not need to author agents. It needs to explain where agents come from, how plugins are discovered, and how a repository becomes available to those agents at runtime.

The current implementation has three related filesystem concepts:

- The app workspace root, configured by `ATHENA_WORKSPACE_ROOT` or the process working directory.
- Plugin search paths, configured by `ATHENA_PLUGIN_PATHS` and `ATHENA_SYSTEM_PLUGIN_PATHS`, with relative paths resolved from the app workspace root.
- Target repositories, which are local filesystem paths operators want agents to inspect or modify.

ADR 0010 makes SQLite the owner of app state indexes and metadata, while plugin source files and artifact payloads remain filesystem-owned. ADR 0011 requires runtime backend requests to carry workspace and working-directory context, but it does not require the console to persist repository records before the product supports multi-repo workspace management.

## Decision

Treat repository wiring as operator configuration and task/workflow context for now, not as a first-class persisted app-state resource.

The app workspace root remains the owner boundary for Team Orchestrator state:

- `.athena/team-orchestrator.sqlite` lives under `config.workspaceRoot` plus `config.stateDir`.
- Relative plugin search paths resolve from `config.workspaceRoot`.
- Local plugin source directories stay on disk; SQLite indexes plugin, agent, and workflow-template metadata.
- Runtime artifact metadata is stored in SQLite while artifact payloads remain filesystem-owned.

Agents remain plugin/manifest-backed. The console should expose an agent catalog and plugin status, but it should not present agent creation as the normal operator path.

Target repositories are local paths supplied through deployment configuration, environment, plugin/workflow conventions, or run input. In local Docker Compose, the current bridge is:

- `ATHENA_REPO_HOST_PATH` on the host.
- `ATHENA_REPO_CONTAINER_PATH`, defaulting to `/workspace/target-repo`, inside services.
- `ATHENA_SANDBOX_WORKSPACE_HOST_PATH` for sandbox host path awareness.

The current task runtime runs `local-command` and `container-command` agents from a bounded working directory inside the plugin package. A target repository therefore must be passed to the agent by input, environment, or plugin convention until a future runtime contract mounts or selects target repositories directly.

## Operator Model

Use these terms in console and docs:

- Workspace: the local Team Orchestrator operating directory that owns app state, relative config, plugin discovery, and local artifacts.
- Plugin path: a filesystem path containing plugin packages. Plugins provide agents and workflow templates through manifests.
- Agent: a manifest-backed capability loaded from a plugin. Operators enable and run agents; they do not create agents in the console.
- Target repo: the local codebase or project path the operator wants work performed against.
- Run context: the task or workflow inputs that tell an agent which target repo, files, branch, or objective to use.

## Implementation Guidance

The smallest truthful product path is UI and documentation guidance over new persistence:

1. Surface workspace root, plugin search paths, loaded plugin status, and loaded agents in operator-facing UI.
2. Explain the Docker Compose repo mount variables and the default `/workspace/target-repo` convention.
3. Make create-work entry points prompt for the target repo path or repo context as part of task/workflow inputs when the selected agent or template expects it.
4. Keep sample plugin and first-run docs explicit that sample agents are plugin-provided and can be replaced by adding plugin directories to configured search paths.
5. Do not add a repository table, repository CRUD UI, clone flow, GitHub OAuth, or agent-authoring UI in this epic.

If later product work needs multiple saved repositories, per-repo schedules, remote clone credentials, or selectable workspace contexts, create a follow-up ADR for a first-class repository resource in app state.

## Validation

- Architecture reviewed against ADR 0008, ADR 0010, and ADR 0011.
- Flywheel state validates after backlog movement.
- Engineering stories should verify copy and affordances in browser QA, including first-run and empty-state paths.

## Consequences

This keeps the next engineering stories small and honest. Operators get clearer instructions for wiring their own repo, while the backend avoids prematurely committing to repository persistence semantics.

The tradeoff is that target repo selection remains convention-driven until a future story promotes repositories into app state. UI copy must be precise so operators understand that the console discovers agents from plugins and sends repo context into work, rather than creating agents or managing repositories as durable resources.

## Risks

- Operators may expect a saved repository picker. The UI should name the current model directly and avoid implying persistence that does not exist.
- Plugin authors may use inconsistent input names for repo paths. Template and sample guidance should converge on clear naming.
- Container and local-process runtime behavior differ. Docs should call out the Docker Compose mount variables separately from direct local execution.
