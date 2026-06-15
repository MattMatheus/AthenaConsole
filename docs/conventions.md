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

## Preview Banner Standard

Any doc section describing a capability that is **designed but not yet enforced in the current build** must carry this exact banner:

```markdown
> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**
```

### When to use the preview banner

Place this banner at the top of any section that describes:

- Multi-user isolation or per-workspace confinement
- Server-derived scope (as opposed to client-asserted scope)
- Per-user cost enforcement or cross-user budget accounting
- Workspace membership gates on data access
- Referential integrity across workspace boundaries (e.g., `workspace_members` table, FK enforcement)

**Remove the banner only when the corresponding epic story is marked DONE.** The tracking reference is epic 2026.44, stories .02–.04 (story .01, workspace CRUD + Admin RBAC, is built and committed).

### Background for authors

As of the current build:

- Workspace scope is client-asserted via the `x-athena-scope-workspaces` request header (`packages/core/src/api/middleware/auth.ts:81`).
- There is no `workspace_members` table.
- Server-derived scope and referential-integrity FKs are not yet implemented.
- Epic 2026.44.01 (workspace CRUD + Admin RBAC) is built and committed.
- Epic 2026.44.02–.04 are designed but not yet enforced.

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
