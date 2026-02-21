import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { LspDocumentSymbol, LspService } from "../control-plane/interfaces.js";
import { AthenaError } from "../runtime/errors.js";

export const ATHENA_LSP_DEFINITION_TOOL = "athena_lsp_definition";
export const ATHENA_LSP_REFERENCES_TOOL = "athena_lsp_references";
export const ATHENA_LSP_SYMBOLS_TOOL = "athena_lsp_symbols";

export interface SymbolicNavigationPositionInput {
  file: string;
  line: number;
  character: number;
  symbol?: string;
  maxResults?: number;
  snippetLineCount?: number;
}

export interface SymbolicNavigationSymbolsInput {
  file: string;
  query?: string;
  maxResults?: number;
  snippetLineCount?: number;
}

export interface SymbolicNavigationLocation {
  path: string;
  line: number;
  character: number;
  snippet: string;
  signature?: string;
}

export interface SymbolicNavigationSymbolMatch {
  path: string;
  name: string;
  kind: number;
  line: number;
  character: number;
  snippet: string;
  detail?: string;
}

export interface SymbolicNavigationResult {
  tool: string;
  backend: "lsp" | "grep-fallback";
  symbol?: string;
  items: SymbolicNavigationLocation[] | SymbolicNavigationSymbolMatch[];
  truncated: boolean;
  notice?: string;
}

export interface SymbolicNavigationTools {
  athena_lsp_definition(input: SymbolicNavigationPositionInput): Promise<SymbolicNavigationResult>;
  athena_lsp_references(input: SymbolicNavigationPositionInput): Promise<SymbolicNavigationResult>;
  athena_lsp_symbols(input: SymbolicNavigationSymbolsInput): Promise<SymbolicNavigationResult>;
}

export interface SymbolicNavigationOptions {
  workspaceRoot: string;
  lspService: LspService;
}

const DEFAULT_MAX_RESULTS = 24;
const DEFAULT_SNIPPET_LINE_COUNT = 1;
const MAX_MAX_RESULTS = 200;
const MAX_SNIPPET_LINE_COUNT = 6;
const SEARCHABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".go"]);
const IGNORED_DIRS = new Set([".git", "node_modules", ".athena", "dist", "build", "coverage"]);

export function createSymbolicNavigationTools(options: SymbolicNavigationOptions): SymbolicNavigationTools {
  return {
    athena_lsp_definition: (input) => getDefinition(options, input),
    athena_lsp_references: (input) => getReferences(options, input),
    athena_lsp_symbols: (input) => getSymbols(options, input)
  };
}

async function getDefinition(
  options: SymbolicNavigationOptions,
  input: SymbolicNavigationPositionInput
): Promise<SymbolicNavigationResult> {
  const maxResults = clamp(input.maxResults, 1, MAX_MAX_RESULTS, DEFAULT_MAX_RESULTS);
  const snippetLineCount = clamp(input.snippetLineCount, 1, MAX_SNIPPET_LINE_COUNT, DEFAULT_SNIPPET_LINE_COUNT);
  try {
    const locations = await options.lspService.getDefinition(input.file, input.line, input.character);
    const hover = await options.lspService.getHoverInfo(input.file, input.line, input.character);
    const items = (
      await Promise.all(
        locations.slice(0, maxResults).map(async (location) =>
          buildLocationMatch(options.workspaceRoot, location.uri, location.range.start.line, location.range.start.character, {
            snippetLineCount,
            ...(hover?.contents ? { signature: hover.contents } : {})
          })
        )
      )
    ).filter((entry): entry is SymbolicNavigationLocation => Boolean(entry));
    return {
      tool: ATHENA_LSP_DEFINITION_TOOL,
      backend: "lsp",
      ...(input.symbol ? { symbol: input.symbol } : {}),
      items,
      truncated: locations.length > items.length
    };
  } catch (error) {
    const fallback = await grepFallback(options.workspaceRoot, input, ATHENA_LSP_DEFINITION_TOOL);
    return fallbackResult(ATHENA_LSP_DEFINITION_TOOL, fallback, error);
  }
}

async function getReferences(
  options: SymbolicNavigationOptions,
  input: SymbolicNavigationPositionInput
): Promise<SymbolicNavigationResult> {
  const maxResults = clamp(input.maxResults, 1, MAX_MAX_RESULTS, DEFAULT_MAX_RESULTS);
  const snippetLineCount = clamp(input.snippetLineCount, 1, MAX_SNIPPET_LINE_COUNT, DEFAULT_SNIPPET_LINE_COUNT);
  try {
    const locations = await options.lspService.getReferences(input.file, input.line, input.character);
    const items = (
      await Promise.all(
        locations.slice(0, maxResults).map(async (location) =>
          buildLocationMatch(options.workspaceRoot, location.uri, location.range.start.line, location.range.start.character, {
            snippetLineCount
          })
        )
      )
    ).filter((entry): entry is SymbolicNavigationLocation => Boolean(entry));
    return {
      tool: ATHENA_LSP_REFERENCES_TOOL,
      backend: "lsp",
      ...(input.symbol ? { symbol: input.symbol } : {}),
      items,
      truncated: locations.length > items.length
    };
  } catch (error) {
    const fallback = await grepFallback(options.workspaceRoot, input, ATHENA_LSP_REFERENCES_TOOL);
    return fallbackResult(ATHENA_LSP_REFERENCES_TOOL, fallback, error);
  }
}

async function getSymbols(
  options: SymbolicNavigationOptions,
  input: SymbolicNavigationSymbolsInput
): Promise<SymbolicNavigationResult> {
  const maxResults = clamp(input.maxResults, 1, MAX_MAX_RESULTS, DEFAULT_MAX_RESULTS);
  const snippetLineCount = clamp(input.snippetLineCount, 1, MAX_SNIPPET_LINE_COUNT, DEFAULT_SNIPPET_LINE_COUNT);
  try {
    const symbols = await options.lspService.getDocumentSymbols(input.file);
    const flattened = flattenSymbols(symbols)
      .filter((symbol) => !input.query || symbol.name.toLowerCase().includes(input.query.toLowerCase()))
      .slice(0, maxResults);
    const items = (
      await Promise.all(
        flattened.map(async (symbol) => {
          const match = await buildLocationMatch(
            options.workspaceRoot,
            toFileUri(options.workspaceRoot, input.file),
            symbol.range.start.line,
            symbol.range.start.character,
            {
              snippetLineCount
            }
          );
          if (!match) {
            return undefined;
          }
          const item: SymbolicNavigationSymbolMatch = {
            path: match.path,
            name: symbol.name,
            kind: symbol.kind,
            line: match.line,
            character: match.character,
            snippet: match.snippet,
            ...(symbol.detail ? { detail: symbol.detail } : {})
          };
          return item;
        })
      )
    ).filter((entry): entry is SymbolicNavigationSymbolMatch => Boolean(entry));
    return {
      tool: ATHENA_LSP_SYMBOLS_TOOL,
      backend: "lsp",
      ...(input.query ? { symbol: input.query } : {}),
      items,
      truncated: flattenSymbols(symbols).length > items.length
    };
  } catch (error) {
    const fallback = await grepFallback(options.workspaceRoot, {
      file: input.file,
      line: 0,
      character: 0,
      ...(input.query ? { symbol: input.query } : {}),
      maxResults,
      snippetLineCount
    }, ATHENA_LSP_SYMBOLS_TOOL);
    const symbolItems: SymbolicNavigationSymbolMatch[] = fallback.items.map((item) => ({
      path: item.path,
      name: item.snippet.trim(),
      kind: 0,
      line: item.line,
      character: item.character,
      snippet: item.snippet
    }));
    return {
      tool: ATHENA_LSP_SYMBOLS_TOOL,
      backend: "grep-fallback",
      ...(fallback.symbol ? { symbol: fallback.symbol } : {}),
      items: symbolItems,
      truncated: fallback.truncated,
      notice: fallback.notice
    };
  }
}

function flattenSymbols(symbols: LspDocumentSymbol[]): LspDocumentSymbol[] {
  const out: LspDocumentSymbol[] = [];
  const stack = [...symbols];
  while (stack.length > 0) {
    const symbol = stack.shift();
    if (!symbol) {
      continue;
    }
    out.push(symbol);
    if (Array.isArray(symbol.children) && symbol.children.length > 0) {
      stack.unshift(...symbol.children);
    }
  }
  return out;
}

async function grepFallback(
  workspaceRoot: string,
  input: SymbolicNavigationPositionInput,
  tool: string
): Promise<{
  symbol?: string;
  items: SymbolicNavigationLocation[];
  truncated: boolean;
  notice: string;
}> {
  const symbol = input.symbol?.trim() || (await readSymbolAtPosition(workspaceRoot, input.file, input.line, input.character));
  if (!symbol) {
    return {
      items: [],
      truncated: false,
      notice: `${tool} fallback unavailable: could not infer symbol token.`
    };
  }
  const maxResults = clamp(input.maxResults, 1, MAX_MAX_RESULTS, DEFAULT_MAX_RESULTS);
  const snippetLineCount = clamp(input.snippetLineCount, 1, MAX_SNIPPET_LINE_COUNT, DEFAULT_SNIPPET_LINE_COUNT);
  const files = await collectWorkspaceSourceFiles(workspaceRoot);
  const matches: SymbolicNavigationLocation[] = [];
  const needle = symbol.toLowerCase();
  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      if (!line.toLowerCase().includes(needle)) {
        continue;
      }
      const character = line.toLowerCase().indexOf(needle);
      matches.push(
        createLocationFromLine({
          workspaceRoot,
          absolutePath: file,
          line: index,
          character,
          lines,
          snippetLineCount
        })
      );
      if (matches.length >= maxResults) {
        return {
          symbol,
          items: matches,
          truncated: true,
          notice: "LSP unavailable; returned grep-style textual matches."
        };
      }
    }
  }
  return {
    symbol,
    items: matches,
    truncated: false,
    notice: "LSP unavailable; returned grep-style textual matches."
  };
}

async function buildLocationMatch(
  workspaceRoot: string,
  uri: string,
  line: number,
  character: number,
  options: { snippetLineCount: number; signature?: string }
): Promise<SymbolicNavigationLocation | undefined> {
  const absolutePath = fromFileUri(uri);
  const lines = (await readFile(absolutePath, "utf8")).split(/\r?\n/);
  const base = createLocationFromLine({
    workspaceRoot,
    absolutePath,
    line,
    character,
    lines,
    snippetLineCount: options.snippetLineCount
  });
  return {
    ...base,
    ...(options.signature ? { signature: compactSignature(options.signature) } : {})
  };
}

function createLocationFromLine(input: {
  workspaceRoot: string;
  absolutePath: string;
  line: number;
  character: number;
  lines: string[];
  snippetLineCount: number;
}): SymbolicNavigationLocation {
  const start = Math.max(0, input.line - input.snippetLineCount + 1);
  const end = Math.min(input.lines.length, input.line + input.snippetLineCount);
  const snippet = input.lines
    .slice(start, end)
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  return {
    path: toWorkspacePath(input.workspaceRoot, input.absolutePath),
    line: input.line + 1,
    character: input.character + 1,
    snippet: snippet || input.lines[input.line]?.trimEnd() || ""
  };
}

async function collectWorkspaceSourceFiles(workspaceRoot: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [workspaceRoot];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        queue.push(nextPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (hasSupportedExtension(entry.name)) {
        out.push(nextPath);
      }
    }
  }
  return out;
}

function hasSupportedExtension(path: string): boolean {
  for (const ext of SEARCHABLE_EXTENSIONS) {
    if (path.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

async function readSymbolAtPosition(
  workspaceRoot: string,
  file: string,
  line: number,
  character: number
): Promise<string | undefined> {
  if (!Number.isInteger(line) || line < 0 || !Number.isInteger(character) || character < 0) {
    return undefined;
  }
  const absolutePath = resolve(workspaceRoot, file);
  if (!(await fileExists(absolutePath))) {
    return undefined;
  }
  const lines = (await readFile(absolutePath, "utf8")).split(/\r?\n/);
  const currentLine = lines[line];
  if (!currentLine) {
    return undefined;
  }
  const left = currentLine.slice(0, character + 1);
  const right = currentLine.slice(character + 1);
  const leftMatch = /[A-Za-z0-9_.$-]+$/.exec(left);
  const rightMatch = /^[A-Za-z0-9_.$-]+/.exec(right);
  const token = `${leftMatch?.[0] ?? ""}${rightMatch?.[0] ?? ""}`.trim();
  if (!token) {
    return undefined;
  }
  return token.replace(/^[^A-Za-z_]+/, "").replace(/[^A-Za-z0-9_]+$/, "") || undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

function toWorkspacePath(workspaceRoot: string, absolutePath: string): string {
  const rel = relative(workspaceRoot, absolutePath).replaceAll("\\", "/");
  return rel.startsWith("..") ? absolutePath : rel;
}

function fallbackResult(
  tool: string,
  fallback: { symbol?: string; items: SymbolicNavigationLocation[]; truncated: boolean; notice: string },
  error: unknown
): SymbolicNavigationResult {
  return {
    tool,
    backend: "grep-fallback",
    ...(fallback.symbol ? { symbol: fallback.symbol } : {}),
    items: fallback.items,
    truncated: fallback.truncated,
    notice: `${fallback.notice} (${normalizeErrorMessage(error)})`
  };
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof AthenaError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value as number));
}

function compactSignature(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function fromFileUri(uri: string): string {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri;
  }
}

function toFileUri(workspaceRoot: string, file: string): string {
  return pathToFileURL(resolve(workspaceRoot, file)).toString();
}
