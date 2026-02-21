---
title: "Local-First Governance: The .athena/ State Architecture"
description: Why a git-friendly, CLI-driven workflow is the only way for engineers to orchestrate AI teams.
pubDate: 2026-02-23
author: Team Orchestrator
tags:
  - engineering
  - local-first
  - cli
---

Cloud-only agent platforms that hide state and telemetry are a "black-box" for the engineer. At Team Orchestrator, we believe that for AI to be part of the engineering workflow, it must live in the engineering environment.

We call this **Local-First Governance**.

## The `.athena/` Directory Structure

When you initialize a repository with `athena run`, the local `.athena/` folder becomes the source of truth for your mission state. It includes:

1. **`.athena/evidence/`:** The Evidence Bundle, as discussed in previous posts.
2. **`.athena/mission/`:** Local telemetry and real-time execution logs.
3. **`.athena/config/`:** Specialist profiles, mission parameters, and policy-aware configurations.

## Git-Friendly Orchestration

By keeping state local and structured, Team Orchestrator integrates seamlessly with your existing Git workflows. You can version-control your mission parameters, review specialist profiles in a pull request, and audit Evidence Bundles alongside your code changes.

## CLI-Driven Velocity

`athena mission launch` is more than just a command; it's an entry point for a governed workforce. It allows you to orchestrate complex specialist missions directly from your terminal, without ever leaving your IDE. 

Local-First Governance is about bringing the power of autonomous agents into the environment you already use and trust. The `.athena/` architecture is the bridge between AI capability and engineering discipline. 
