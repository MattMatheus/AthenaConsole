<!-- AUDIENCE: Internal/Technical -->

# Documentation Conventions

Writing conventions for all Team Orchestrator documentation. Every plan that adds or edits docs must follow these rules.

---

## Audience Tags

Every documentation file must open with an HTML comment audience tag as its first line:

```
<!-- AUDIENCE: Operator -->
<!-- AUDIENCE: Admin/Enterprise -->
<!-- AUDIENCE: Engineer/SDK -->
<!-- AUDIENCE: Internal/Technical -->
<!-- AUDIENCE: Public/Internal -->
```

Choose the most specific tag. A file may serve two primary audiences (e.g., `Public/Internal`); do not stack more than two.

---

## Positioning Rule

Lead with enterprise and multiplayer team operation as the primary narrative. Present local/single-operator as a deployment mode, not the product identity.

**Correct example to copy:**

> Team Orchestrator is a work control plane for teams and operators. Deploy it as a local workbench for one operator, or as a trusted server for a team with workspace membership, RBAC, cost governance, and audit-ready run history.

**Do not write:**

> Team Orchestrator is a local-first, enterprise-capable platform…

The "local-first" framing leads with the narrower case. The platform is enterprise-first by narrative; local deployment is one supported profile.

---

## Voice and Vocabulary

Use operator/platform language. Name the controls your readers will actually interact with:

- **Work primitives**: tasks, missions, runs, workflow templates, run templates
- **Agent system**: agents, plugins, capabilities, connector packs
- **Governance**: workspaces, members, roles, RBAC, approvals, limits, policy
- **Cost**: budgets, usage, cost, quotas, ledger
- **Observability**: events, artifacts, logs, evidence, run history, audit
- **Scheduling**: schedules, recurring work, triggers

**Avoid lore terms**: pilots, hangars, swarms — these are not product vocabulary.

### Naming rule

The product name is **Team Orchestrator**. `Athena`, `AthenaConsole`, and `@athena/*` are implementation history — acceptable in code references, CLI commands, environment variable names, and package names, but never the lead abstraction in prose.

Correct: "Configure the `ATHENA_OPENAI_API_KEY` environment variable."
Incorrect: "Athena needs a provider key."

---

## Enterprise Readiness Notes

Any doc section describing a capability that is **designed but not yet fully production-ready** must state what is built and what still gates shared deployment. Use the specific gate rather than copying old workspace warnings.

```markdown
> **Status**: Partially production-ready. Workspace CRUD, workspace membership,
> Admin RBAC, and membership-backed workspace scope narrowing are implemented.
> Remaining trusted-server gates include cost-governance enforcement,
> Postgres/server persistence readiness, and any domain-specific referential
> integrity or data-layer hardening named below.
```

### When to use an enterprise readiness note

Place a status note at the top of any section that describes:

- Per-user cost enforcement or cross-user budget accounting
- Referential integrity across workspace-owned records
- Postgres/server persistence readiness
- Multi-user deployment guidance that depends on unbuilt operational controls
- Connector or artifact retention behavior that affects workspace privacy

Do not describe workspace membership or server-derived workspace scope as unbuilt. Those controls are implemented in the current build.

### Background for authors

As of the current build:

- Workspace scope is derived from authenticated subject membership for non-admin users.
- `x-athena-scope-workspaces` is an optional narrowing hint; requested workspaces outside membership scope are rejected.
- `workspace_members` exists in SQLite app-state and is exposed through workspace member API routes.
- Global Admin users can administer workspaces and memberships.
- Cost budget enforcement and Postgres/server persistence remain separate readiness gates.

---

## Link Hygiene

- Use **relative links only** in all documentation. No absolute file-system paths.
- Before marking any doc task done, stage new files with `git add` and run:

  ```bash
  npm run check:docs
  ```

  Expected output: `Checked relative markdown links in N files. No broken links.`

- Stage new or moved files **before** running the check — the checker uses `git ls-files` and only reads tracked files.
- When deleting a file, find all inbound links first:

  ```bash
  grep -rn "filename" --include='*.md' .
  ```

  Repoint or remove every markdown hyperlink (bracket-paren format) before deleting.

---

## Maturity / Status Notes

When a page describes something partially built, state it plainly at the top:

```
> **Status**: Partially implemented. See the preview banner below for unbuilt isolation controls.
```

Do not imply the system is complete when it is not. Readers rely on these docs to decide whether to expose the server to untrusted users.
