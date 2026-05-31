# LSP and Symbolic Navigation Tools

Athena includes a set of tools that allow agents to navigate and reason about codebases semantically using the Language Server Protocol (LSP).

## Why Symbolic Navigation?

Traditional agent tools like `grep` or simple file reads often lead to "guessing" where functions are defined or how they are used. By providing symbolic tools, we reduce the number of turns an agent needs to take and improve its accuracy when performing complex code analysis tasks.

## Available Tools

The following tools are available to any agent with the `code-analysis` skill enabled:

### `athena_lsp_definition`
Returns the location and signature of a symbol's definition at a given file, line, and character position.

- **Inputs**: `file`, `line`, `character`, `symbol?`, `maxResults?`, `snippetLineCount?`
- **Output**: A list of locations (path, line, character) and code snippets.

### `athena_lsp_references`
Returns a list of all callers or usages of a symbol at a given position.

- **Inputs**: `file`, `line`, `character`, `symbol?`, `maxResults?`, `snippetLineCount?`
- **Output**: A list of locations where the symbol is referenced.

### `athena_lsp_symbols`
Returns all symbols (classes, functions, variables) defined in a specific file.

- **Inputs**: `file`, `query?` (optional search filter), `maxResults?`, `snippetLineCount?`
- **Output**: A list of symbols and their metadata (kind, location, snippet).

## Graceful Fallback (Grep-style)

If an LSP service is not available (e.g., the language is not supported or the LSP server is not running), these tools automatically fall back to a "grep-style" textual search.

- **Grep Fallback**: The tools will attempt to infer the symbol at the given position and then search the workspace for other occurrences of that token.
- **Notice**: When falling back, the tool response will include a `notice` field indicating that the result was obtained via textual matching rather than semantic analysis.

## Supported File Extensions

By default, the following extensions are searchable:
- `.ts`, `.tsx`
- `.js`, `.jsx`, `.mjs`, `.cjs`
- `.go`

## Implementation Details

The symbolic navigation tools are implemented in `src/tools/symbolic-navigation.ts`. They interact with the `LspService` interface to communicate with language servers.

To optimize for token efficiency, tool outputs are formatted to return only the relevant code snippets and signatures, rather than the entire file.
