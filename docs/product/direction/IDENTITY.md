<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Product Identity

## Core Essence

Team Orchestrator is a web-first agent orchestrator for people who want to turn repeatable work into inspectable, runnable agent tasks.

The first user is a solo developer. The next user is a product operator. Shared/team usage may come later, but the product should stay grounded in one person using a local-first console to run useful agents with confidence.

## Product Promise

Team Orchestrator helps an operator:

- define tasks
- choose compatible formal agents
- run tasks or missions locally
- inspect logs, events, artifacts, and outputs
- compose repeatable workflows over time
- keep risky actions bounded by approvals and loop limits

## Positioning

The product is an agent orchestrator, not an enterprise fleet governance plane.

It is closer to a local-first workflow console for formal agents than to a generic prompt runner. Existing systems such as Airflow, Flyte, Kestra, and LangGraph are useful reference points, but Team Orchestrator's core product model is agent-native: tasks, agents, plugins, runs, artifacts, events, and operator control.

## Naming

- Product name: Team Orchestrator
- Domain: `teamorchestrator.com`
- Athena: legacy/internal name that may remain as a default planning agent or orchestrator role, but should not be the dominant product abstraction.

Naming cleanup can happen later. New planning should prefer Team Orchestrator unless referring to current code, packages, commands, or legacy artifacts.

## Voice

Use practical operator language:

- tasks, missions, runs
- agents and plugins
- local process, container, API, module, DAG
- events, artifacts, logs, evidence
- approvals, limits, schedules

Avoid making the product depend on lore-heavy terms such as pilots, hangars, flight directors, swarms, or enterprise fleet governance.
