<!-- AUDIENCE: Internal/Technical -->

# Stage 4: Memory System (Completed)

## Objectives (from plan)

- Add deterministic session history sanitation/truncation.
- Add tool-call/tool-result pairing validation in history pipeline.
- Deliver retrievable memory interfaces (`memory_search`, `memory_get`) with SQLite/FTS baseline.

## Implemented In This Slice

- Contracts extended for transcript tool-call/tool-result metadata:
  - `kind?: "message" | "tool-call" | "tool-result"`
  - `toolCallId?`, `toolName?`, `isError?`
- Contracts extended for memory citations with line ranges:
  - `MemorySearchResult.lineStart?`
  - `MemorySearchResult.lineEnd?`
- Config extended with Stage 4 prep settings:
  - `history.*` (max entries, per-entry truncation, tool pairing repair toggle, control-char stripping)
  - `memory.*` (feature flag + SQLite path/result/snippet budgets + transcript indexing toggle)
- New deterministic runtime history sanitizer:
  - file: `src/runtime/history.ts`
  - strips disallowed control characters
  - truncates oversized entries
  - applies max history limit
  - repairs tool-call/tool-result pairing
  - drops orphan/duplicate tool results
  - inserts synthetic missing tool results
- Runtime integration:
  - `createRuntime().run()` now sanitizes historical transcript entries before context assembly.
  - runtime now runs memory recall on user input and injects bounded cited snippets into context (`memory.maxInjectedChars`).
- Baseline retrievable memory interfaces implemented:
  - file: `src/memory/index.ts`
  - `createMemoryManager().search(query, { maxResults, minScore })`
  - `createMemoryManager().get({ path, from, lines })`
  - SQLite + FTS5 indexing path (with graceful fallback to file-scan search when SQLite runtime support is unavailable)
  - source scope: `MEMORY.md` + `memory/**/*.md` + optional `.athena/transcripts/*.jsonl`
  - `memory_get` guardrails:
    - workspace-relative path only
    - allowed roots only (`MEMORY.md` or `memory/`)
    - markdown files only
- CLI commands added:
  - `athena memory search --query <text> [--max-results <n>] [--min-score <n>]`
  - `athena memory get --path <workspace-relative-path> [--from <line>] [--lines <count>]`

## Verification

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed

## Tests Added

- `tests/runtime.history.test.ts`
  - missing tool result synthesis
  - orphan/duplicate tool-result dropping
  - deterministic truncation/limit behavior
- `tests/runtime.validation.test.ts`
  - runtime-level check that orphan tool results are repaired out of provider input context
  - runtime-level memory snippet injection coverage
- `tests/config.test.ts`
  - history/memory env parsing coverage
- `tests/memory.manager.test.ts`
  - memory search coverage for default memory sources
  - bounded line reads via `memory_get`
  - path traversal rejection
  - optional transcript indexing coverage
- `tests/cli.memory.test.ts`
  - end-to-end CLI coverage for memory search/get

## Exit Criteria Status

- Search and get return bounded, cited snippets: met.
- Deterministic history sanitation/truncation and pairing validation with tests: met.
- Initial SQLite/FTS indexing path defined and integrated: met.
