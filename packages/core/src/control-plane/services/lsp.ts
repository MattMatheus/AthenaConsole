import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, extname, sep } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { pathToFileURL } from "node:url";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { LspDocumentSymbol, LspHoverInfo, LspLocation, LspService } from "../interfaces.js";

export type LspLanguage = "typescript" | "go";

export interface LspServerCommand {
  command: string;
  args?: string[];
}

export interface LocalLspServiceOptions {
  serverCommands?: Partial<Record<LspLanguage, LspServerCommand>>;
  requestTimeoutMs?: number;
}

interface JsonRpcRequest {
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: AthenaError) => void;
  timeout: NodeJS.Timeout;
}

interface OpenDocumentState {
  version: number;
  text: string;
}

const DEFAULT_SERVER_COMMANDS: Record<LspLanguage, LspServerCommand> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"]
  },
  go: {
    command: "gopls"
  }
};

const RESTARTABLE_ERROR_CODES = new Set(["SESSION_IO_ERROR", "PROVIDER_ERROR"] as const);

export class LocalLspService implements LspService {
  private readonly clients = new Map<LspLanguage, ManagedLspClient>();
  private readonly requestTimeoutMs: number;
  private readonly serverCommands: Record<LspLanguage, LspServerCommand>;

  constructor(
    private readonly config: AthenaConfig,
    options: LocalLspServiceOptions = {}
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    this.serverCommands = {
      typescript: options.serverCommands?.typescript ?? DEFAULT_SERVER_COMMANDS.typescript,
      go: options.serverCommands?.go ?? DEFAULT_SERVER_COMMANDS.go
    };
  }

  async getDefinition(file: string, line: number, character: number): Promise<LspLocation[]> {
    return this.execute(file, line, character, async (client, uri) => {
      const result = await client.request("textDocument/definition", {
        textDocument: { uri },
        position: { line, character }
      });
      return normalizeDefinitionResponse(result);
    });
  }

  async getReferences(file: string, line: number, character: number): Promise<LspLocation[]> {
    return this.execute(file, line, character, async (client, uri) => {
      const result = await client.request("textDocument/references", {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true }
      });
      return normalizeLocationArrayResponse(result);
    });
  }

  async getHoverInfo(file: string, line: number, character: number): Promise<LspHoverInfo | undefined> {
    return this.execute(file, line, character, async (client, uri) => {
      const result = await client.request("textDocument/hover", {
        textDocument: { uri },
        position: { line, character }
      });
      return normalizeHoverResponse(result);
    });
  }

  async getDocumentSymbols(file: string): Promise<LspDocumentSymbol[]> {
    const language = detectLanguage(file);
    if (!language) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `No LSP server mapping exists for file '${file}'. Supported extensions: .ts/.tsx/.js/.jsx/.mjs/.cjs/.go`
      );
    }
    const absoluteFile = normalizeAbsolutePath(this.config.workspaceRoot, file);
    const uri = pathToFileURL(absoluteFile).href;

    let client = await this.getOrCreateClient(language);
    try {
      await client.syncDocument(uri, language, absoluteFile);
      const result = await client.request("textDocument/documentSymbol", {
        textDocument: { uri }
      });
      return normalizeDocumentSymbolsResponse(result);
    } catch (error) {
      if (!shouldRestartClient(error)) {
        throw error;
      }
      this.clients.delete(language);
      await client.shutdown();
      client = await this.getOrCreateClient(language);
      await client.syncDocument(uri, language, absoluteFile);
      const result = await client.request("textDocument/documentSymbol", {
        textDocument: { uri }
      });
      return normalizeDocumentSymbolsResponse(result);
    }
  }

  async shutdown(): Promise<void> {
    const clients = [...this.clients.values()];
    this.clients.clear();
    await Promise.allSettled(clients.map(async (client) => client.shutdown()));
  }

  private async execute<T>(
    file: string,
    line: number,
    character: number,
    request: (client: ManagedLspClient, uri: string) => Promise<T>
  ): Promise<T> {
    assertPosition(line, character);
    const language = detectLanguage(file);
    if (!language) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `No LSP server mapping exists for file '${file}'. Supported extensions: .ts/.tsx/.js/.jsx/.mjs/.cjs/.go`
      );
    }

    const absoluteFile = normalizeAbsolutePath(this.config.workspaceRoot, file);
    const uri = pathToFileURL(absoluteFile).href;

    let client = await this.getOrCreateClient(language);

    try {
      await client.syncDocument(uri, language, absoluteFile);
      return await request(client, uri);
    } catch (error) {
      if (!shouldRestartClient(error)) {
        throw error;
      }
      this.clients.delete(language);
      await client.shutdown();
      client = await this.getOrCreateClient(language);
      await client.syncDocument(uri, language, absoluteFile);
      return request(client, uri);
    }
  }

  private async getOrCreateClient(language: LspLanguage): Promise<ManagedLspClient> {
    const existing = this.clients.get(language);
    if (existing && !existing.hasExited()) {
      return existing;
    }

    const command = this.serverCommands[language];
    const child = spawn(command.command, command.args ?? [], {
      cwd: this.config.workspaceRoot,
      stdio: "pipe"
    });

    const client = new ManagedLspClient({
      child,
      workspaceRoot: this.config.workspaceRoot,
      requestTimeoutMs: this.requestTimeoutMs,
      command
    });
    await client.initialize();
    this.clients.set(language, client);
    return client;
  }
}

class ManagedLspClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly openDocuments = new Map<string, OpenDocumentState>();
  private buffer = Buffer.alloc(0);
  private initialized = false;
  private exited = false;

  constructor(
    private readonly options: {
      child: ChildProcessWithoutNullStreams;
      workspaceRoot: string;
      requestTimeoutMs: number;
      command: LspServerCommand;
    }
  ) {
    this.options.child.stdout.on("data", (chunk: Buffer) => this.handleData(chunk));
    this.options.child.on("exit", () => {
      this.exited = true;
      this.rejectPending(new AthenaError("SESSION_IO_ERROR", "Language server process exited unexpectedly.", true));
    });
    this.options.child.on("error", (error) => {
      this.exited = true;
      this.rejectPending(
        new AthenaError(
          "SESSION_IO_ERROR",
          `Failed to start language server '${this.options.command.command}': ${error.message}`,
          true,
          error
        )
      );
    });
  }

  hasExited(): boolean {
    return this.exited;
  }

  async initialize(): Promise<void> {
    if (this.exited) {
      throw new AthenaError("SESSION_IO_ERROR", "Language server process is not available.", true);
    }
    if (this.initialized) {
      return;
    }
    await this.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(this.options.workspaceRoot).href,
      capabilities: {}
    });
    this.notify("initialized", {});
    this.initialized = true;
  }

  async syncDocument(uri: string, language: LspLanguage, absoluteFile: string): Promise<void> {
    const text = await readFile(absoluteFile, "utf8");
    const open = this.openDocuments.get(uri);
    if (!open) {
      this.notify("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: language === "go" ? "go" : "typescript",
          version: 1,
          text
        }
      });
      this.openDocuments.set(uri, {
        version: 1,
        text
      });
      return;
    }

    if (open.text === text) {
      return;
    }

    const nextVersion = open.version + 1;
    this.notify("textDocument/didChange", {
      textDocument: {
        uri,
        version: nextVersion
      },
      contentChanges: [{ text }]
    });
    this.openDocuments.set(uri, {
      version: nextVersion,
      text
    });
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    if (this.exited) {
      throw new AthenaError("SESSION_IO_ERROR", "Language server process is not available.", true);
    }

    const id = this.nextId;
    this.nextId += 1;

    const payload: JsonRpcRequest = {
      id,
      method,
      ...(params !== undefined ? { params } : {})
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new AthenaError("PROVIDER_ERROR", `Language server request timed out: ${method}`, true));
      }, this.options.requestTimeoutMs);

      this.pending.set(id, {
        method,
        resolve,
        reject,
        timeout
      });

      try {
        this.write(payload);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(
          new AthenaError(
            "SESSION_IO_ERROR",
            `Failed to write language server request '${method}'.`,
            true,
            error
          )
        );
      }
    });
  }

  notify(method: string, params?: unknown): void {
    const payload: JsonRpcNotification = {
      method,
      ...(params !== undefined ? { params } : {})
    };
    this.write(payload);
  }

  async shutdown(): Promise<void> {
    if (this.exited) {
      return;
    }

    try {
      await this.request("shutdown", {});
    } catch {
      // Best-effort shutdown.
    }

    try {
      this.notify("exit", {});
    } catch {
      // Best-effort shutdown.
    }

    this.options.child.kill("SIGTERM");
    this.exited = true;
    this.rejectPending(new AthenaError("SESSION_IO_ERROR", "Language server process was shut down.", true));
  }

  private write(payload: JsonRpcRequest | JsonRpcNotification): void {
    if (this.exited) {
      throw new AthenaError("SESSION_IO_ERROR", "Language server process is not available.", true);
    }
    const body = JSON.stringify({
      jsonrpc: "2.0",
      ...payload
    });
    const message = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
    this.options.child.stdin.write(message, "utf8");
  }

  private handleData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n", 0, "utf8");
      if (headerEnd < 0) {
        return;
      }
      const headerText = this.buffer.subarray(0, headerEnd).toString("utf8");
      const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(headerText);
      if (!contentLengthMatch) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const contentLength = Number.parseInt(contentLengthMatch[1] ?? "0", 10);
      const totalLength = headerEnd + 4 + contentLength;
      if (this.buffer.length < totalLength) {
        return;
      }
      const body = this.buffer.subarray(headerEnd + 4, totalLength).toString("utf8");
      this.buffer = this.buffer.subarray(totalLength);
      this.handleMessage(body);
    }
  }

  private handleMessage(body: string): void {
    let message: unknown;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }

    if (!message || typeof message !== "object") {
      return;
    }

    const candidate = message as {
      id?: unknown;
      result?: unknown;
      error?: { message?: unknown };
    };

    if (typeof candidate.id !== "number") {
      return;
    }

    const pending = this.pending.get(candidate.id);
    if (!pending) {
      return;
    }
    this.pending.delete(candidate.id);
    clearTimeout(pending.timeout);

    if (candidate.error) {
      const responseError = new AthenaError(
        "PROVIDER_ERROR",
        `Language server request '${pending.method}' failed: ${String(candidate.error.message ?? "unknown error")}`,
        true
      );
      pending.reject(responseError);
      return;
    }

    pending.resolve(candidate.result);
  }

  private rejectPending(error: AthenaError): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

function assertPosition(line: number, character: number): void {
  if (!Number.isInteger(line) || line < 0) {
    throw new AthenaError("CONFIG_ERROR", `line must be a non-negative integer. Received: ${line}.`);
  }
  if (!Number.isInteger(character) || character < 0) {
    throw new AthenaError("CONFIG_ERROR", `character must be a non-negative integer. Received: ${character}.`);
  }
}

function normalizeAbsolutePath(workspaceRoot: string, file: string): string {
  const trimmed = file.trim();
  if (!trimmed) {
    throw new AthenaError("CONFIG_ERROR", "file is required.");
  }
  const root = resolve(workspaceRoot);
  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolute !== root && !absolute.startsWith(rootWithSeparator)) {
    throw new AthenaError("CONFIG_ERROR", "file must resolve inside the workspace root.");
  }
  return absolute;
}

function shouldRestartClient(error: unknown): boolean {
  if (!(error instanceof AthenaError)) {
    return false;
  }
  return RESTARTABLE_ERROR_CODES.has(error.code as (typeof RESTARTABLE_ERROR_CODES extends Set<infer T> ? T : never));
}

function detectLanguage(file: string): LspLanguage | undefined {
  const extension = extname(file).toLowerCase();
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
    return "typescript";
  }
  if (extension === ".go") {
    return "go";
  }
  return undefined;
}

function normalizeDefinitionResponse(result: unknown): LspLocation[] {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
    const locations: LspLocation[] = [];
    for (const entry of result) {
      const location = normalizeLocationOrLink(entry);
      if (location) {
        locations.push(location);
      }
    }
    return locations;
  }
  const location = normalizeLocationOrLink(result);
  return location ? [location] : [];
}

function normalizeLocationArrayResponse(result: unknown): LspLocation[] {
  if (!Array.isArray(result)) {
    return [];
  }
  const locations: LspLocation[] = [];
  for (const entry of result) {
    const location = normalizeLocation(entry);
    if (location) {
      locations.push(location);
    }
  }
  return locations;
}

function normalizeLocationOrLink(value: unknown): LspLocation | undefined {
  const location = normalizeLocation(value);
  if (location) {
    return location;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    targetUri?: unknown;
    targetRange?: unknown;
  };
  if (typeof candidate.targetUri !== "string") {
    return undefined;
  }
  const range = normalizeRange(candidate.targetRange);
  if (!range) {
    return undefined;
  }
  return {
    uri: candidate.targetUri,
    range
  };
}

function normalizeLocation(value: unknown): LspLocation | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    uri?: unknown;
    range?: unknown;
  };
  if (typeof candidate.uri !== "string") {
    return undefined;
  }
  const range = normalizeRange(candidate.range);
  if (!range) {
    return undefined;
  }
  return {
    uri: candidate.uri,
    range
  };
}

function normalizeRange(value: unknown): LspLocation["range"] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    start?: unknown;
    end?: unknown;
  };
  const start = normalizePosition(candidate.start);
  const end = normalizePosition(candidate.end);
  if (!start || !end) {
    return undefined;
  }
  return { start, end };
}

function normalizePosition(value: unknown): { line: number; character: number } | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    line?: unknown;
    character?: unknown;
  };
  if (typeof candidate.line !== "number" || typeof candidate.character !== "number") {
    return undefined;
  }
  if (!Number.isInteger(candidate.line) || !Number.isInteger(candidate.character)) {
    return undefined;
  }
  return {
    line: candidate.line,
    character: candidate.character
  };
}

function normalizeHoverResponse(result: unknown): LspHoverInfo | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const candidate = result as {
    contents?: unknown;
    range?: unknown;
  };

  const contents = normalizeHoverContents(candidate.contents);
  if (!contents) {
    return undefined;
  }

  const normalizedRange = normalizeRange(candidate.range);
  return {
    contents,
    ...(normalizedRange ? { range: normalizedRange } : {})
  };
}

function normalizeHoverContents(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeHoverContents(entry)).filter((entry): entry is string => Boolean(entry));
    if (normalized.length === 0) {
      return undefined;
    }
    return normalized.join("\n\n");
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as {
    kind?: unknown;
    value?: unknown;
    language?: unknown;
  };

  if (typeof candidate.value === "string" && typeof candidate.kind === "string") {
    return candidate.value;
  }

  if (typeof candidate.value === "string" && typeof candidate.language === "string") {
    return `\`\`\`${candidate.language}\n${candidate.value}\n\`\`\``;
  }

  return undefined;
}

function normalizeDocumentSymbolsResponse(result: unknown): LspDocumentSymbol[] {
  if (!Array.isArray(result)) {
    return [];
  }
  const symbols: LspDocumentSymbol[] = [];
  for (const entry of result) {
    const symbol = normalizeDocumentSymbol(entry);
    if (symbol) {
      symbols.push(symbol);
    }
  }
  return symbols;
}

function normalizeDocumentSymbol(value: unknown): LspDocumentSymbol | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    name?: unknown;
    kind?: unknown;
    range?: unknown;
    selectionRange?: unknown;
    detail?: unknown;
    children?: unknown;
    location?: unknown;
    containerName?: unknown;
  };

  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    return undefined;
  }
  if (typeof candidate.kind !== "number" || !Number.isInteger(candidate.kind)) {
    return undefined;
  }

  const range = normalizeRange(candidate.range);
  const selectionRange = normalizeRange(candidate.selectionRange) ?? range;
  if (!range || !selectionRange) {
    return normalizeSymbolInformation(value);
  }

  const children = Array.isArray(candidate.children)
    ? candidate.children
        .map((child) => normalizeDocumentSymbol(child))
        .filter((child): child is LspDocumentSymbol => Boolean(child))
    : undefined;

  return {
    name: candidate.name,
    kind: candidate.kind,
    range,
    selectionRange,
    ...(typeof candidate.detail === "string" && candidate.detail.trim() ? { detail: candidate.detail } : {}),
    ...(children && children.length > 0 ? { children } : {})
  };
}

function normalizeSymbolInformation(value: unknown): LspDocumentSymbol | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    name?: unknown;
    kind?: unknown;
    location?: unknown;
    containerName?: unknown;
  };
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    return undefined;
  }
  if (typeof candidate.kind !== "number" || !Number.isInteger(candidate.kind)) {
    return undefined;
  }
  if (!candidate.location || typeof candidate.location !== "object") {
    return undefined;
  }
  const locationCandidate = candidate.location as { range?: unknown };
  const range = normalizeRange(locationCandidate.range);
  if (!range) {
    return undefined;
  }
  return {
    name: candidate.name,
    kind: candidate.kind,
    range,
    selectionRange: range,
    ...(typeof candidate.containerName === "string" && candidate.containerName.trim()
      ? { detail: `container: ${candidate.containerName}` }
      : {})
  };
}
