# Team Orchestrator Core Compatibility Guide

This package-level guide documents compatibility surfaces for the Team Orchestrator core runtime. For current operator and agent-author workflows, start with the repo-level guide at `../../../docs/user-guide/README.md`.

The current product direction is Team Orchestrator: a web console and orchestration system for creating agents, connecting repositories, launching real work, and reviewing run artifacts. The core package centers current CLI, API, and console workflows on plugin-backed agents and task execution.

## Core Concepts

These concepts remain useful when working directly with the core runtime:

*   **Plugin agents:** Plugin agents are manifest-backed executable units that bundle capabilities, inputs, runtime implementation, permissions, and artifact contracts. They allow you to run focused work such as code review, repository summarization, or documentation analysis through the console, task API, or workflow templates.

*   **Providers:** Providers are adapters that connect the runtime to different language model backends, whether they are remote APIs (like those from OpenAI or Anthropic) or local models. A provider abstraction layer allows the system to switch between providers and implement fallback policies for improved reliability.

*   **Work Queues:** Each agent session has a dedicated work queue that manages tasks. This system ensures that work is processed sequentially, can be deferred or re-prioritized, and will resume correctly even after a crash or restart.

*   **Control Plane:** The control plane is the shared service layer for CLI, API, and console operations.
