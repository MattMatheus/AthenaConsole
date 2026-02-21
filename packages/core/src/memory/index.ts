import { existsSync, mkdirSync } from "node:fs";
import { lstat, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { AthenaConfig } from "../shared/config.js";
import type { MemoryRecord, MemorySearchResult } from "../shared/contracts.js";
import { AthenaError } from "../runtime/errors.js";

export interface MemoryStore {
  add(record: MemoryRecord): void;
  search(query: string): MemorySearchResult[];
}

export interface MemorySearchOptions {
  maxResults?: number;
  minScore?: number;
}

export interface MemoryGetRequest {
  path: string;
  from?: number;
  lines?: number;
}

export interface MemoryGetResult {
  path: string;
  text: string;
  lineStart: number;
  lineEnd: number;
}

export function createInMemoryStore(): MemoryStore {
  const records: MemoryRecord[] = [];

  return {
    add(record: MemoryRecord): void {
      records.push(record);
    },
    search(query: string): MemorySearchResult[] {
      const q = query.toLowerCase();
      return records
        .filter((r) => r.content.toLowerCase().includes(q))
        .map((r, index) => ({
          id: r.id,
          sourcePath: r.sourcePath,
          snippet: r.content.slice(0, 240),
          score: 1 - index * 0.01,
          citation: `${r.sourcePath}${r.lineStart ? `#L${r.lineStart}` : ""}`
        }));
    }
  };
}

export interface MemoryManager {
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;
  get(request: MemoryGetRequest): Promise<MemoryGetResult>;
}

const DEFAULT_MAX_RESULTS = 6;
const DEFAULT_MIN_SCORE = 0;
const DEFAULT_MAX_SNIPPET_CHARS = 700;
const DEFAULT_MAX_INJECTED_CHARS = 2_500;
const MEMORY_MD_NAME = "MEMORY.md";
const CHUNK_LINES = 40;
const CHUNK_OVERLAP_LINES = 10;
const SQLITE_FTS_TABLE = "chunks_fts";

type IndexSource = "memory" | "transcript";

interface IndexDocument {
  relPath: string;
  source: IndexSource;
  content: string;
  mtimeMs: number;
  size: number;
}

type SqliteDatabase = {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
};

const require = createRequire(import.meta.url);

export function createFileMemoryManager(config: AthenaConfig): MemoryManager {
  let sqliteManager: ReturnType<typeof createSqliteMemoryManager> | undefined;
  let sqliteInitialized = false;

  return {
    async search(query: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult[]> {
      if (!(config.memory?.enabled ?? false)) {
        return [];
      }
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return [];
      }

      if (!sqliteInitialized) {
        sqliteManager = createSqliteMemoryManager(config);
        sqliteInitialized = true;
      }

      if (sqliteManager) {
        return sqliteManager.search(normalizedQuery, options);
      }

      const docs = await collectIndexDocuments(config);
      const results: MemorySearchResult[] = [];
      const snippetLimit = config.memory?.maxSnippetChars ?? DEFAULT_MAX_SNIPPET_CHARS;

      for (const doc of docs) {
        const lower = doc.content.toLowerCase();
        const index = lower.indexOf(normalizedQuery);
        if (index < 0) {
          continue;
        }

        const score = scoreMatch(lower, normalizedQuery);
        const lineStart = computeLineNumber(doc.content, index);
        const snippetStart = Math.max(0, index - Math.floor(snippetLimit * 0.3));
        const snippetEnd = Math.min(doc.content.length, snippetStart + snippetLimit);
        const snippetText = doc.content.slice(snippetStart, snippetEnd);
        const lineEnd = lineStart + Math.max(0, snippetText.split(/\r?\n/).length - 1);

        results.push({
          id: `${doc.relPath}:${lineStart}`,
          sourcePath: doc.relPath,
          snippet: snippetText,
          score,
          lineStart,
          lineEnd,
          citation:
            lineStart === lineEnd ? `${doc.relPath}#L${lineStart}` : `${doc.relPath}#L${lineStart}-L${lineEnd}`
        });
      }

      const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
      const maxResults = options.maxResults ?? config.memory?.maxResults ?? DEFAULT_MAX_RESULTS;

      return results
        .filter((entry) => entry.score >= minScore)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.sourcePath.localeCompare(b.sourcePath);
        })
        .slice(0, maxResults);
    },
    async get(request: MemoryGetRequest): Promise<MemoryGetResult> {
      if (!(config.memory?.enabled ?? false)) {
        throw new AthenaError("CONFIG_ERROR", "memory is disabled");
      }
      const fullPath = resolveMemoryGetPath(config.workspaceRoot, request.path);
      const relPath = toWorkspaceRelativePath(config.workspaceRoot, fullPath);
      const content = await readFile(fullPath, "utf8");
      const lines = content.split(/\r?\n/);

      const start = Math.max(1, Math.floor(request.from ?? 1));
      const lineCount = Math.max(1, Math.floor(request.lines ?? lines.length));
      const end = Math.min(lines.length, start + lineCount - 1);
      const text = lines.slice(start - 1, end).join("\n");

      return {
        path: relPath,
        text,
        lineStart: start,
        lineEnd: end
      };
    }
  };
}

export function createMemoryManager(config: AthenaConfig): MemoryManager {
  if (!(config.memory?.enabled ?? false)) {
    return {
      async search(): Promise<MemorySearchResult[]> {
        return [];
      },
      async get(): Promise<MemoryGetResult> {
        throw new AthenaError("CONFIG_ERROR", "memory is disabled");
      }
    };
  }
  return createFileMemoryManager(config);
}

export function buildMemoryInjectionSection(
  results: MemorySearchResult[],
  maxInjectedChars = DEFAULT_MAX_INJECTED_CHARS
): string {
  if (!results.length || maxInjectedChars <= 0) {
    return "";
  }
  const lines: string[] = [];
  let used = 0;
  for (const result of results) {
    const citation = result.citation ?? result.sourcePath;
    const block = `[Memory: ${citation}]\n${result.snippet.trim()}\n`;
    if (used + block.length > maxInjectedChars) {
      const remaining = maxInjectedChars - used;
      if (remaining <= 0) {
        break;
      }
      lines.push(block.slice(0, remaining));
      break;
    }
    lines.push(block);
    used += block.length;
  }
  return lines.join("\n").trim();
}

function resolveMemoryGetPath(workspaceRoot: string, requestedPath: string): string {
  const normalized = requestedPath.trim().replace(/\\/g, "/");
  if (!normalized) {
    throw new AthenaError("CONFIG_ERROR", "memory_get path is required");
  }
  if (isAbsolute(normalized)) {
    throw new AthenaError("CONFIG_ERROR", "memory_get path must be workspace-relative");
  }
  if (!(normalized === MEMORY_MD_NAME || normalized.startsWith(`memory/`))) {
    throw new AthenaError("CONFIG_ERROR", "memory_get path must be MEMORY.md or under memory/");
  }
  if (extname(normalized).toLowerCase() !== ".md") {
    throw new AthenaError("CONFIG_ERROR", "memory_get path must be a markdown file");
  }

  const candidate = resolve(workspaceRoot, normalized);
  assertPathWithin(workspaceRoot, candidate);
  if (!existsSync(candidate)) {
    throw new AthenaError("SESSION_IO_ERROR", `memory file not found: ${normalized}`);
  }
  return candidate;
}

async function collectMemoryFiles(workspaceRoot: string): Promise<string[]> {
  const files: string[] = [];
  const memoryPath = resolve(workspaceRoot, MEMORY_MD_NAME);
  if (existsSync(memoryPath)) {
    files.push(memoryPath);
  }
  const memoryDir = resolve(workspaceRoot, "memory");
  if (!existsSync(memoryDir)) {
    return files;
  }

  const stack = [memoryDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const children = await readdir(current, { withFileTypes: true });
    for (const child of children) {
      const fullPath = resolve(current, child.name);
      if (child.isDirectory()) {
        const stat = await lstat(fullPath);
        if (stat.isSymbolicLink()) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (!child.isFile() || extname(child.name).toLowerCase() !== ".md") {
        continue;
      }
      files.push(fullPath);
    }
  }
  return files;
}

async function collectIndexDocuments(config: AthenaConfig): Promise<IndexDocument[]> {
  const docs: IndexDocument[] = [];
  const memoryFiles = await collectMemoryFiles(config.workspaceRoot);
  for (const filePath of memoryFiles) {
    const content = await readFile(filePath, "utf8");
    const fileStat = await stat(filePath);
    docs.push({
      relPath: toWorkspaceRelativePath(config.workspaceRoot, filePath),
      source: "memory",
      content,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size
    });
  }

  if (config.memory?.includeTranscripts) {
    const transcriptFiles = await collectTranscriptFiles(config.workspaceRoot, config.stateDir);
    for (const filePath of transcriptFiles) {
      const raw = await readFile(filePath, "utf8");
      const content = buildTranscriptIndexContent(raw);
      if (!content.trim()) {
        continue;
      }
      const fileStat = await stat(filePath);
      docs.push({
        relPath: toWorkspaceRelativePath(config.workspaceRoot, filePath),
        source: "transcript",
        content,
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size
      });
    }
  }

  return docs;
}

async function collectTranscriptFiles(workspaceRoot: string, stateDir: string): Promise<string[]> {
  const dir = resolve(workspaceRoot, stateDir, "transcripts");
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".jsonl")
    .map((entry) => resolve(dir, entry.name));
}

function buildTranscriptIndexContent(raw: string): string {
  const lines: string[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const trimmed = row.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as { role?: string; content?: string };
      if (typeof parsed.content !== "string" || !parsed.content.trim()) {
        continue;
      }
      lines.push(`${parsed.role ?? "unknown"}: ${parsed.content}`);
    } catch {
      continue;
    }
  }
  return lines.join("\n");
}

function createSqliteMemoryManager(config: AthenaConfig): {
  search(query: string, options: MemorySearchOptions): Promise<MemorySearchResult[]>;
} | null {
  const db = openSqlite(config);
  if (!db) {
    return null;
  }

  let ftsAvailable = true;
  ensureSqliteSchema(db);
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${SQLITE_FTS_TABLE} USING fts5(` +
        "id UNINDEXED, path, source, content)"
    );
  } catch {
    ftsAvailable = false;
  }

  return {
    async search(query: string, options: MemorySearchOptions): Promise<MemorySearchResult[]> {
      await syncSqliteIndex(db, config, ftsAvailable);
      const maxResults = options.maxResults ?? config.memory?.maxResults ?? DEFAULT_MAX_RESULTS;
      const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
      const maxSnippetChars = config.memory?.maxSnippetChars ?? DEFAULT_MAX_SNIPPET_CHARS;
      const rows = ftsAvailable
        ? (db
            .prepare(
              `SELECT c.id, c.path, c.line_start, c.line_end, c.content, bm25(${SQLITE_FTS_TABLE}) AS rank\n` +
                `FROM ${SQLITE_FTS_TABLE} f JOIN chunks c ON c.id = f.id\n` +
                `WHERE ${SQLITE_FTS_TABLE} MATCH ?\n` +
                "ORDER BY rank ASC LIMIT ?"
            )
            .all(toFtsQuery(query), maxResults * 4) as Array<{
            id: string;
            path: string;
            line_start: number;
            line_end: number;
            content: string;
            rank: number;
          }>)
        : (db
            .prepare(
              "SELECT id, path, line_start, line_end, content FROM chunks WHERE lower(content) LIKE ? LIMIT ?"
            )
            .all(`%${query.toLowerCase()}%`, maxResults * 4) as Array<{
            id: string;
            path: string;
            line_start: number;
            line_end: number;
            content: string;
          }>);

      const results = rows
        .map((row) => {
          const score = hasRank(row) ? 1 / (1 + Math.max(0, row.rank)) : scoreMatch(row.content.toLowerCase(), query);
          const snippet = clipAroundMatch(row.content, query, maxSnippetChars);
          return {
            id: row.id,
            sourcePath: row.path,
            snippet,
            score,
            lineStart: row.line_start,
            lineEnd: row.line_end,
            citation:
              row.line_start === row.line_end ? `${row.path}#L${row.line_start}` : `${row.path}#L${row.line_start}-L${row.line_end}`
          } satisfies MemorySearchResult;
        })
        .filter((entry) => entry.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      return results;
    }
  };
}

function hasRank(row: unknown): row is { rank: number } {
  return Boolean(
    row &&
      typeof row === "object" &&
      "rank" in row &&
      typeof (row as { rank?: unknown }).rank === "number"
  );
}

function openSqlite(config: AthenaConfig): SqliteDatabase | null {
  const pathValue = resolveMemoryDbPath(config);
  try {
    mkdirSync(resolve(pathValue, ".."), { recursive: true });
    const sqlite = require("node:sqlite") as {
      DatabaseSync: new (path: string) => SqliteDatabase;
    };
    return new sqlite.DatabaseSync(pathValue);
  } catch (error) {
    return null;
  }
}

function resolveMemoryDbPath(config: AthenaConfig): string {
  const configured = config.memory?.sqlitePath;
  if (configured) {
    const normalized = configured.trim().replace(/\\/g, "/");
    if (!normalized) {
      throw new AthenaError("CONFIG_ERROR", "memory sqlite path cannot be empty");
    }
    if (isAbsolute(normalized)) {
      throw new AthenaError("CONFIG_ERROR", "memory sqlite path must be workspace-relative");
    }
    const candidate = resolve(config.workspaceRoot, normalized);
    assertPathWithin(config.workspaceRoot, candidate);
    return candidate;
  }
  const fallback = resolve(config.workspaceRoot, config.stateDir, "memory", "index.sqlite");
  assertPathWithin(config.workspaceRoot, fallback);
  return fallback;
}

function ensureSqliteSchema(db: SqliteDatabase): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS files (" +
      "path TEXT PRIMARY KEY, " +
      "source TEXT NOT NULL, " +
      "mtime_ms REAL NOT NULL, " +
      "size INTEGER NOT NULL, " +
      "updated_at TEXT NOT NULL)"
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS chunks (" +
      "id TEXT PRIMARY KEY, " +
      "path TEXT NOT NULL, " +
      "source TEXT NOT NULL, " +
      "chunk_index INTEGER NOT NULL, " +
      "line_start INTEGER NOT NULL, " +
      "line_end INTEGER NOT NULL, " +
      "content TEXT NOT NULL)"
  );
}

async function syncSqliteIndex(db: SqliteDatabase, config: AthenaConfig, ftsAvailable: boolean): Promise<void> {
  const dbPath = resolveMemoryDbPath(config);
  await mkdir(resolve(dbPath, ".."), { recursive: true });
  const docs = await collectIndexDocuments(config);
  const livePaths = new Set(docs.map((doc) => doc.relPath));

  const existing = db.prepare("SELECT path, mtime_ms, size FROM files").all() as Array<{
    path: string;
    mtime_ms: number;
    size: number;
  }>;
  const existingByPath = new Map(existing.map((row) => [row.path, row]));

  for (const doc of docs) {
    const known = existingByPath.get(doc.relPath);
    if (known && known.mtime_ms === doc.mtimeMs && known.size === doc.size) {
      continue;
    }
    db.prepare("DELETE FROM chunks WHERE path = ?").run(doc.relPath);
    if (ftsAvailable) {
      db.prepare(`DELETE FROM ${SQLITE_FTS_TABLE} WHERE path = ?`).run(doc.relPath);
    }

    const chunks = chunkDocument(doc);
    for (const chunk of chunks) {
      db.prepare(
        "INSERT OR REPLACE INTO chunks (id, path, source, chunk_index, line_start, line_end, content) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(chunk.id, chunk.path, doc.source, chunk.chunkIndex, chunk.lineStart, chunk.lineEnd, chunk.content);
      if (ftsAvailable) {
        db.prepare(`INSERT INTO ${SQLITE_FTS_TABLE} (id, path, source, content) VALUES (?, ?, ?, ?)`).run(
          chunk.id,
          chunk.path,
          doc.source,
          chunk.content
        );
      }
    }
    db.prepare("INSERT OR REPLACE INTO files (path, source, mtime_ms, size, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      doc.relPath,
      doc.source,
      doc.mtimeMs,
      doc.size,
      new Date().toISOString()
    );
  }

  for (const row of existing) {
    if (livePaths.has(row.path)) {
      continue;
    }
    db.prepare("DELETE FROM chunks WHERE path = ?").run(row.path);
    if (ftsAvailable) {
      db.prepare(`DELETE FROM ${SQLITE_FTS_TABLE} WHERE path = ?`).run(row.path);
    }
    db.prepare("DELETE FROM files WHERE path = ?").run(row.path);
  }
}

function chunkDocument(doc: IndexDocument): Array<{
  id: string;
  path: string;
  chunkIndex: number;
  lineStart: number;
  lineEnd: number;
  content: string;
}> {
  const lines = doc.content.split(/\r?\n/);
  const chunks: Array<{
    id: string;
    path: string;
    chunkIndex: number;
    lineStart: number;
    lineEnd: number;
    content: string;
  }> = [];

  let start = 0;
  let chunkIndex = 0;
  const stride = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP_LINES);
  while (start < lines.length) {
    const endExclusive = Math.min(lines.length, start + CHUNK_LINES);
    const slice = lines.slice(start, endExclusive).join("\n").trim();
    if (slice) {
      const lineStart = start + 1;
      const lineEnd = endExclusive;
      chunks.push({
        id: `${doc.relPath}:${chunkIndex}:${lineStart}`,
        path: doc.relPath,
        chunkIndex,
        lineStart,
        lineEnd,
        content: slice
      });
      chunkIndex += 1;
    }
    if (endExclusive >= lines.length) {
      break;
    }
    start += stride;
  }
  return chunks;
}

function toFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, "\"\"")}"`)
    .join(" ");
}

function clipAroundMatch(content: string, query: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }
  const lower = content.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) {
    return content.slice(0, maxChars);
  }
  const start = Math.max(0, idx - Math.floor(maxChars * 0.3));
  return content.slice(start, Math.min(content.length, start + maxChars));
}

function toWorkspaceRelativePath(workspaceRoot: string, absolutePath: string): string {
  const rel = relative(workspaceRoot, absolutePath);
  return rel.split(sep).join("/");
}

function assertPathWithin(baseDir: string, candidate: string): void {
  const rel = relative(baseDir, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new AthenaError("CONFIG_ERROR", `memory path escapes workspace: ${candidate}`);
  }
}

function computeLineNumber(content: string, index: number): number {
  if (index <= 0) {
    return 1;
  }
  let lines = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      lines += 1;
    }
  }
  return lines;
}

function scoreMatch(content: string, query: string): number {
  let count = 0;
  let cursor = 0;
  while (true) {
    const found = content.indexOf(query, cursor);
    if (found < 0) {
      break;
    }
    count += 1;
    cursor = found + query.length;
  }
  return count;
}
