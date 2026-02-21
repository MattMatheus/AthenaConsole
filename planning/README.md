# Team Orchestrator Internal Documentation

This directory contains internal project management, architectural, and developer-focused documentation.

## Consolidation Notes

- This folder consolidates content that previously lived under:
  - `packages/core/planning/`
  - `apps/marketing/planning/`
- Where files shared the same relative path and had different content, the marketing variant was retained with a `.marketing` suffix (for example: `archive/handoff.marketing.md`).
- New planning artifacts should be created under `planning/` only.

## 🛠 Developer Guide

For contributors and developers extending the Team Orchestrator platform.

- [**Architecture**](developer/01-architecture.md) - Deep dive into the system design.
- [**Setup**](developer/02-setup.md) - Setting up the development environment.
- [**Contributing**](developer/03-contributing.md) - Guidelines for contributing to the project.
- [**Extending Team Orchestrator**](developer/04-extending.md) - How to add new providers or tools.
- [**Standards**](developer/05-standards.md) - Development and test standards.
- [**CLI Reference**](developer/06-cli-reference.md) - Comprehensive command-line reference.

## 📂 Project Management

- [**Backlog**](backlog/active/README.md) - Project roadmap and task tracking.
- [**Architecture Decisions**](architecture/rbac-foundation-and-permission-model.md) - Detailed ADRs and models.
- [**Research**](research/active/README.md) - Active research and experiments.
- [**Archive**](archive/README.md) - Historical records and past stages.
- [**Prompts**](prompts/active/next-agent-seed-prompt.md) - Internal agent seed prompts.

---

*For public user documentation, see `docs/README.md`.*
