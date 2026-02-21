import { readFile } from "node:fs/promises";
import { resolve as resolveFsPath } from "node:path";
import { dirname, join, normalize } from "node:path/posix";
import type { LspDocumentSymbol, LspService } from "../control-plane/interfaces.js";
import type { ContextStrategy } from "../shared/contracts.js";
import { fileExistsAtRef, fileSizeAtRef, readFileAtRef } from "./git.js";
import type { ReferencedFileSnapshot, ReferencedFileSnapshotMeta } from "./types.js";

const IMPORT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
const DEFAULT_MAX_REFERENCED_FILES = 16;
const DEFAULT_MAX_REFERENCED_FILE_CHARS = 12_000;

interface AddedImport {
  sourcePath: string;
  importSpecifier: string;
}

function isTsJsFile(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?)$/i.test(path);
}

function isRepoRelativePath(path: string): boolean {
  const normalized = normalize(path);
  return !(normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/"));
}

function extractRelativeImportSpecifiers(lineWithoutPlus: string): string[] {
  const specifiers: string[] = [];
  const patterns: RegExp[] = [
    /(?:import|export)\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/g
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lineWithoutPlus)) !== null) {
      const specifier = match[1]?.trim();
      if (specifier && (specifier.startsWith("./") || specifier.startsWith("../"))) {
        specifiers.push(specifier);
      }
    }
  }
  return specifiers;
}

function parseAddedRelativeImports(diff: string): AddedImport[] {
  const out: AddedImport[] = [];
  let currentPath: string | undefined;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ ")) {
      const nextPath = line.slice(4).trim();
      if (nextPath === "/dev/null") {
        currentPath = undefined;
        continue;
      }
      currentPath = nextPath.startsWith("b/") ? nextPath.slice(2) : nextPath;
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) {
      continue;
    }
    if (!currentPath || !isTsJsFile(currentPath)) {
      continue;
    }
    const code = line.slice(1);
    const specifiers = extractRelativeImportSpecifiers(code);
    for (const importSpecifier of specifiers) {
      out.push({ sourcePath: currentPath, importSpecifier });
    }
  }

  const seen = new Set<string>();
  const deduped: AddedImport[] = [];
  for (const item of out) {
    const key = `${item.sourcePath}::${item.importSpecifier}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function buildCandidatePaths(sourcePath: string, importSpecifier: string): string[] {
  const sourceDir = dirname(sourcePath);
  const base = normalize(join(sourceDir, importSpecifier));
  if (!isRepoRelativePath(base)) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(base);
  for (const ext of IMPORT_EXTENSIONS) {
    candidates.add(`${base}${ext}`);
    candidates.add(`${base}/index${ext}`);
  }
  return [...candidates];
}

export async function collectReferencedFileSnapshots(options: {
  repoPath: string;
  headRef: string;
  diff: string;
  maxReferencedFiles?: number;
  maxReferencedFileChars?: number;
  contextStrategy?: ContextStrategy;
  lspService?: LspService;
}): Promise<{ snapshots: ReferencedFileSnapshot[]; meta: ReferencedFileSnapshotMeta }> {
  const maxReferencedFiles = options.maxReferencedFiles ?? DEFAULT_MAX_REFERENCED_FILES;
  const maxReferencedFileChars = options.maxReferencedFileChars ?? DEFAULT_MAX_REFERENCED_FILE_CHARS;
  const imports = parseAddedRelativeImports(options.diff);

  const snapshots: ReferencedFileSnapshot[] = [];
  const loadedPaths = new Set<string>();

  for (const item of imports) {
    if (snapshots.length >= maxReferencedFiles) {
      break;
    }

    const candidates = buildCandidatePaths(item.sourcePath, item.importSpecifier);
    for (const candidate of candidates) {
      if (loadedPaths.has(candidate)) {
        break;
      }
      const exists = await fileExistsAtRef(options.repoPath, options.headRef, candidate);
      if (!exists) {
        continue;
      }
      const size = await fileSizeAtRef(options.repoPath, options.headRef, candidate);
      const symbolicCompactionEnabled = options.contextStrategy === "symbolic-signatures" && Boolean(options.lspService);
      const symbolicSnapshot = symbolicCompactionEnabled
        ? await buildSymbolicSignatureSnapshot({
            lspService: options.lspService!,
            repoPath: options.repoPath,
            path: candidate,
            maxChars: maxReferencedFileChars
          })
        : undefined;
      const content = symbolicSnapshot?.content ?? (await readFileAtRef(options.repoPath, options.headRef, candidate, maxReferencedFileChars));
      snapshots.push({
        sourcePath: item.sourcePath,
        importSpecifier: item.importSpecifier,
        path: candidate,
        chars: content.length,
        truncated:
          symbolicSnapshot?.truncated ??
          (typeof size === "number" ? size > maxReferencedFileChars : false),
        contentFormat: symbolicSnapshot ? "symbolic-signatures" : "full",
        content
      });
      loadedPaths.add(candidate);
      break;
    }
  }

  return {
    snapshots,
    meta: {
      attemptedImports: imports.length,
      loadedSnapshots: snapshots.length,
      limitHit: imports.length > snapshots.length && snapshots.length >= maxReferencedFiles,
      maxReferencedFiles,
      maxReferencedFileChars
    }
  };
}

async function buildSymbolicSignatureSnapshot(options: {
  lspService: LspService;
  repoPath: string;
  path: string;
  maxChars: number;
}): Promise<{ content: string; truncated: boolean } | undefined> {
  try {
    const absolutePath = resolveFsPath(options.repoPath, options.path);
    const symbols = await options.lspService.getDocumentSymbols(absolutePath);
    if (symbols.length === 0) {
      return undefined;
    }
    const rendered = await renderSymbolSignatureProjection(absolutePath, options.path, symbols, options.maxChars);
    return rendered;
  } catch {
    return undefined;
  }
}

async function renderSymbolSignatureProjection(
  absolutePath: string,
  workspacePath: string,
  symbols: LspDocumentSymbol[],
  maxChars: number
): Promise<{ content: string; truncated: boolean }> {
  const rows = flattenSymbols(symbols).slice(0, 256);
  if (rows.length === 0) {
    return {
      content: "[symbolic-signatures]\n(no symbols found)",
      truncated: false
    };
  }

  const declarationLines = await readDeclarationLines(absolutePath);
  const lines = rows.map((entry) => {
    const lineNumber = entry.symbol.range.start.line + 1;
    const signatureLine = declarationLines[entry.symbol.range.start.line] ?? "";
    const displayName = entry.fullName;
    const detail = entry.symbol.detail?.trim();
    const kind = formatSymbolKind(entry.symbol.kind);
    return [
      `- ${kind} ${displayName}${detail ? ` :: ${detail}` : ""} (L${lineNumber})`,
      signatureLine ? `  ${signatureLine}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  });

  const header = ["[symbolic-signatures]", `file: ${workspacePath}`, `symbols: ${rows.length}`, ""].join("\n");
  const body = `${header}${lines.join("\n")}`.trim();
  if (body.length <= maxChars) {
    return { content: body, truncated: false };
  }

  const marker = `\n\n[symbol list truncated to ${maxChars} chars]`;
  const clipped = body.slice(0, Math.max(0, maxChars - marker.length)).trimEnd();
  return {
    content: `${clipped}${marker}`,
    truncated: true
  };
}

async function readDeclarationLines(absolutePath: string): Promise<string[]> {
  try {
    return (await readFile(absolutePath, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\s+/g, " ").slice(0, 180));
  } catch {
    return [];
  }
}

function flattenSymbols(symbols: LspDocumentSymbol[]): Array<{ symbol: LspDocumentSymbol; fullName: string }> {
  const output: Array<{ symbol: LspDocumentSymbol; fullName: string }> = [];
  const stack = symbols
    .slice()
    .reverse()
    .map((symbol) => ({
      symbol,
      parentName: ""
    }));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const fullName = current.parentName ? `${current.parentName}.${current.symbol.name}` : current.symbol.name;
    output.push({
      symbol: current.symbol,
      fullName
    });
    if (Array.isArray(current.symbol.children) && current.symbol.children.length > 0) {
      for (let index = current.symbol.children.length - 1; index >= 0; index -= 1) {
        const child = current.symbol.children[index];
        if (!child) {
          continue;
        }
        stack.push({
          symbol: child,
          parentName: fullName
        });
      }
    }
  }

  return output;
}

function formatSymbolKind(kind: number): string {
  switch (kind) {
    case 5:
      return "Class";
    case 6:
      return "Method";
    case 7:
      return "Property";
    case 8:
      return "Field";
    case 11:
      return "Interface";
    case 12:
      return "Function";
    case 13:
      return "Variable";
    case 14:
      return "Constant";
    case 23:
      return "Struct";
    case 24:
      return "Event";
    case 25:
      return "Operator";
    case 26:
      return "TypeParameter";
    default:
      return "Symbol";
  }
}
