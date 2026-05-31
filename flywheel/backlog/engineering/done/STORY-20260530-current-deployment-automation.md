---
kind: story
id: STORY-20260530-current-deployment-automation
status: done
owner_role: DevOps Engineer
source: direct
success_metric: Deployment automation, if retained, targets the current local-server Team Orchestrator model rather than old cloud/fleet workflows.
release_scope: optional
ready: true
---

# Story: Current Deployment Automation

## Metadata
- `id`: STORY-20260530-current-deployment-automation
- `owner_role`: DevOps Engineer
- `status`: done
- `source`: direct
- `decision_refs`: [0006, 0018]
- `epic`: docs/product/epics/refinement/2026.32.00-epic-useful-feature-migration-and-legacy-removal.md
- `success_metric`: Deployment automation, if retained, targets the current local-server Team Orchestrator model rather than old cloud/fleet workflows.
- `release_scope`: optional

## Problem Statement

The nested GitHub Actions workflows were inert and reflected an old deployment posture. If deployment automation is still useful, it should be rebuilt for the current local-server/LAN deployment model rather than reconnected wholesale.

## Scope
- In: review old nested workflow intent; design or implement current CI/deployment automation for local-server compose validation, image build checks, release artifact checks, or deployment docs validation.
- Out: reviving old Azure/AKS fleet deployment workflows without a current deployment story.

## Acceptance Criteria
1. A keep/remove/rebuild decision is recorded for deployment automation.
2. Any retained workflow lives in the root `.github/workflows` location and targets current Team Orchestrator deployment needs.
3. Old nested workflow assumptions are not reintroduced.
4. Local-server deployment docs and automation agree.
5. CI checks, if added, are bounded and reproducible locally.

## Validation
- Required checks: shellcheck or workflow validation if available, local compose/deployment smoke commands as applicable, docs link review, `git diff --check`.

## Dependencies
- Local-server deployment direction.

## Risks
- Deployment automation can grow quickly; keep this to current local-server verification unless a separate cloud deployment epic exists.

## Engineering Handoff
- `change_summary`: Rebuilt retained deployment automation as a root GitHub Actions workflow for the current local-server delivery model. Added `.github/workflows/local-server-validation.yml` to run core typecheck, schema checks, PDK tests, console typecheck, compose config checks, and smoke-command wiring. Added deployment automation docs recording the rebuild decision and out-of-scope cloud deployment assumptions. Updated local-server compose/docs to persist current `agent-runs` artifacts instead of retired runtime artifact directories.
- `validation_evidence`: `ruby -e 'require "yaml"; ARGV.each { |file| YAML.load_file(file); puts "ok #{file}" }' .github/workflows/local-server-validation.yml docker-compose.local.yml docker-compose.server.yml`; `podman compose -f docker-compose.local.yml config >/tmp/team-orchestrator-local-compose.yml`; `ATHENA_AUTH_API_TOKEN=ci-local-server-token ATHENA_CONSOLE_PASSWORD=ci-local-server-password ATHENA_SERVER_WORKSPACE_PATH=/tmp/team-orchestrator/workspace ATHENA_SERVER_STATE_PATH=/tmp/team-orchestrator/state ATHENA_SERVER_ARTIFACTS_PATH=/tmp/team-orchestrator/artifacts ATHENA_SERVER_REPOS_PATH=/tmp/team-orchestrator/repos ATHENA_SERVER_PLUGINS_PATH=/tmp/team-orchestrator/plugins ATHENA_SERVER_SECRETS_PATH=/tmp/team-orchestrator/secrets ATHENA_SANDBOX_WORKSPACE_HOST_PATH=/tmp/team-orchestrator/workspace podman compose -f docker-compose.server.yml config >/tmp/team-orchestrator-server-compose.yml`; `npm run smoke:product -- --help`; docs link existence check for the deployment automation, local-server, fresh-server, and workflow files; `rg -n "specialist|persona|athena-prime" README.md docs/developer/product-dev-guides docker-compose.server.yml .github/workflows/local-server-validation.yml -g '!**/dist/**'` returned no matches; `git diff --check`.
- `qa_focus`: Confirm the workflow remains bounded to local-server validation, does not publish or deploy cloud resources, and keeps compose/docs paths aligned with current artifact ownership.
- `open_risks`: Full stack startup smoke is still operator-local because it requires host port binding, server secrets, and container runtime state. Compose rendering is now validated locally with Podman.

## QA Verdict
- `verdict`: Pass.
- `evidence_quality`: High. YAML parsing, local/server compose rendering via Podman, smoke command wiring, docs link checks, retired-term grep, and whitespace validation passed locally.
- `defects`: None found.
- `state_transition`: Ready for `engineering/done`.

## Transition History
- `2026-05-31T01:32:08Z`: `intake` -> `active`
- `2026-05-31T01:35:12Z`: `active` -> `done`
