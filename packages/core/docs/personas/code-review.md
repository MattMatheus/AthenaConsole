# Code Review Persona

## Definition

- Persona file: `personas/code-review.json`
- Curated context directory: `personas/code-review/`
- CLI: `athena persona run --name code-review ...`

## Inputs

Required:

- `--repo <path>`: repo path (workspace-relative)
- `--head <branch>`: branch under review

Optional:

- `--base <branch>`: comparison branch (defaults to `main`, otherwise auto-detects via `origin/HEAD`)
- `--session <id>`: optional session id (auto-generated if omitted)

## Safety Rules

- Aborts if the repo has uncommitted changes.
- Aborts if no base comparison branch can be resolved.

## Outputs

The run always writes an audit bundle under:

- `.athena/persona-runs/<runId>/result.json`
- `.athena/persona-runs/<runId>/report.md`

`result.json` includes `contextManifest` with:

- loaded curated files in deterministic order
- per-file truncation flags/reasons
- aggregate counts and budget limits

Optional copies:

- `--out-json <path>`
- `--out-md <path>`

Stdout modes:

- `--stdout summary|json|md|none`

## Findings

Findings include:

- `priority`: `P1` (critical) to `P3` (nice-to-have)
- `confidence`: float `0.0` to `1.0`
- `mergeGate`: `fail` when any `P1` finding exists (otherwise `pass` unless reviewer chooses stricter gating)

## Dependency Inspection

Dependency/import inspection is best-effort:

- If the ecosystem cannot be detected or required artifacts are missing, review continues and reports that dependency changes were not inspected.

## Context Loading Contract (V1)

The code review persona uses a single-pass, deterministic context assembly pipeline.

### Curated Persona Context

All required persona context must live under `personas/code-review/` and be referenced by `personas/code-review.json`.

Schema fields:

- `context.promptFiles: string[]`
- `context.skillFiles: string[]`
- `context.docFiles: string[]`
- `context.maxFileChars?: number`
- `context.maxTotalChars?: number`

Context types (loaded in order):

- Prompt files: core instructions and output contract.
- Skill files: checklists/tactics for review behavior.
- Doc files: repo-specific conventions/policies for this persona.

Hard rule:

- Any persona context path that resolves outside `personas/code-review/` is rejected.

### Change Set Context

The runtime assembles:

- Resolved compare refs: `base..head`
- Changed files list (bounded)
- Dependency/import inspection summary (best-effort)
- Unified diff (bounded)

### Referenced File Snapshots (TS/JS V1)

To improve review completeness, the runtime may load a bounded set of referenced file snapshots based on newly introduced TS/JS imports in the diff.

Rules:

- Only relative imports are resolved (`./` or `../`).
- Candidate resolution tries: exact path, then common extensions (`.ts`, `.tsx`, `.js`, `.jsx`), then `index.*` for directory imports.
- Files are read from the `head` ref (e.g. via `git show head:<path>`), without modifying the working tree.
- Reads are bounded by `maxReferencedFiles` and `maxReferencedFileChars`.
- These limits are configured on `review.maxReferencedFiles` and `review.maxReferencedFileChars` in `personas/code-review.json`.

### Prompt Assembly (Single Pass)

The persona run is single-pass only (no on-demand follow-up context requests).

System message contains:

- Persona contract (JSON-only output, suggestions only, `P1..P3`, confidence `[0,1]`, `mergeGate`)
- Prompt files (in order)
- Skill files (in order)

User message contains:

- Doc files (in order)
- Change set context
- Referenced file snapshots

### Truncation/Budgets

All sections are bounded and include explicit truncation markers when limits are hit (e.g. `[truncated to N chars]`).

### Acceptance Criteria (V1)

- Persona run fails fast if any curated context reference escapes `personas/code-review/`.
- Context assembly is stable: same repo state + same persona files produces the same ordered prompt sections.
- Single pass: the persona run does not request additional context after initial assembly.
- Referenced-file snapshots are TS/JS-only and relative-import-only, and remain bounded.
- When dependency inspection cannot run, the result clearly reports that dependency changes were not inspected.
- Output contract includes `mergeGate`, and if the first model response is invalid JSON the runner performs exactly one bounded repair retry.
