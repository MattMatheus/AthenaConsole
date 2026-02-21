import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";

const FAKE_LSP_SCRIPT = `
const { appendFileSync, writeFileSync } = require("node:fs");

const pidLogPath = process.argv[2];
const shouldExitAfterFirstSemanticRequest = process.argv[3] === "exit-after-first";
appendFileSync(pidLogPath, String(process.pid) + "\\n", "utf8");

let buffer = Buffer.alloc(0);
let semanticRequestCount = 0;

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\\r\\n\\r\\n");
    if (headerEnd < 0) {
      return;
    }
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\\s*(\\d+)/i.exec(header);
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4);
      continue;
    }
    const contentLength = Number.parseInt(match[1], 10);
    const total = headerEnd + 4 + contentLength;
    if (buffer.length < total) {
      return;
    }
    const body = buffer.subarray(headerEnd + 4, total).toString("utf8");
    buffer = buffer.subarray(total);
    handleMessage(JSON.parse(body));
  }
});

function handleMessage(message) {
  const id = message.id;
  if (!message.method) {
    return;
  }

  if (message.method === "initialize") {
    respond(id, {
      capabilities: { hoverProvider: true, definitionProvider: true, referencesProvider: true, documentSymbolProvider: true }
    });
    return;
  }

  if (message.method === "shutdown") {
    respond(id, null);
    return;
  }

  if (message.method === "textDocument/definition") {
    semanticRequestCount += 1;
    const uri = message.params.textDocument.uri;
    respond(id, [
      {
        uri,
        range: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 14 }
        }
      }
    ]);
    maybeExit();
    return;
  }

  if (message.method === "textDocument/references") {
    semanticRequestCount += 1;
    const uri = message.params.textDocument.uri;
    respond(id, [
      {
        uri,
        range: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 14 }
        }
      },
      {
        uri,
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 5 }
        }
      }
    ]);
    maybeExit();
    return;
  }

  if (message.method === "textDocument/hover") {
    semanticRequestCount += 1;
    respond(id, {
      contents: {
        kind: "markdown",
        value: "function alpha(): number"
      },
      range: {
        start: { line: 0, character: 9 },
        end: { line: 0, character: 14 }
      }
    });
    maybeExit();
    return;
  }

  if (message.method === "textDocument/documentSymbol") {
    semanticRequestCount += 1;
    respond(id, [
      {
        name: "alpha",
        kind: 12,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 29 }
        },
        selectionRange: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 14 }
        },
        detail: "function alpha()"
      }
    ]);
    maybeExit();
  }
}

function maybeExit() {
  if (!shouldExitAfterFirstSemanticRequest) {
    return;
  }
  if (semanticRequestCount === 1) {
    setTimeout(() => process.exit(0), 5);
  }
}

function respond(id, result) {
  if (id === undefined) {
    return;
  }
  const payload = JSON.stringify({ jsonrpc: "2.0", id, result });
  const message = "Content-Length: " + Buffer.byteLength(payload, "utf8") + "\\r\\n\\r\\n" + payload;
  process.stdout.write(message);
}
`;

describe("control-plane LSP service", () => {
  it("supports definition/reference/hover semantic calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-lsp-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "sample.ts"), "function alpha() { return 1; }\\nalpha();\\n", "utf8");
      const serverPath = join(dir, "fake-lsp.cjs");
      const pidLogPath = join(dir, "fake-lsp-pids.log");
      writeFileSync(serverPath, FAKE_LSP_SCRIPT, "utf8");
      writeFileSync(pidLogPath, "", "utf8");

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config,
        lspOptions: {
          serverCommands: {
            typescript: {
              command: process.execPath,
              args: [serverPath, pidLogPath]
            },
            go: {
              command: process.execPath,
              args: [serverPath, pidLogPath]
            }
          },
          requestTimeoutMs: 2_000
        }
      });

      const definitions = await services.lspService.getDefinition("src/sample.ts", 0, 10);
      expect(definitions).toHaveLength(1);
      expect(definitions[0]?.range.start.line).toBe(0);
      expect(definitions[0]?.range.start.character).toBe(9);

      const references = await services.lspService.getReferences("src/sample.ts", 0, 10);
      expect(references).toHaveLength(2);
      expect(references[1]?.range.start.line).toBe(1);

      const hover = await services.lspService.getHoverInfo("src/sample.ts", 0, 10);
      expect(hover?.contents).toContain("alpha");
      const symbols = await services.lspService.getDocumentSymbols("src/sample.ts");
      expect(symbols).toHaveLength(1);
      expect(symbols[0]?.name).toBe("alpha");

      await services.shutdown?.();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("restarts crashed servers and terminates children on shutdown", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-control-plane-lsp-restart-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "sample.ts"), "function alpha() { return 1; }\\nalpha();\\n", "utf8");
      const serverPath = join(dir, "fake-lsp.cjs");
      const pidLogPath = join(dir, "fake-lsp-pids.log");
      writeFileSync(serverPath, FAKE_LSP_SCRIPT, "utf8");
      writeFileSync(pidLogPath, "", "utf8");

      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({
        config,
        lspOptions: {
          serverCommands: {
            typescript: {
              command: process.execPath,
              args: [serverPath, pidLogPath, "exit-after-first"]
            },
            go: {
              command: process.execPath,
              args: [serverPath, pidLogPath, "exit-after-first"]
            }
          },
          requestTimeoutMs: 2_000
        }
      });

      await services.lspService.getDefinition("src/sample.ts", 0, 10);
      await sleep(100);
      const hover = await services.lspService.getHoverInfo("src/sample.ts", 0, 10);
      expect(hover?.contents).toContain("alpha");

      const startedPids = readFileSync(pidLogPath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10));
      expect(new Set(startedPids).size).toBeGreaterThanOrEqual(2);

      const latestPid = startedPids[startedPids.length - 1];
      expect(latestPid).toBeDefined();
      await services.shutdown?.();
      await waitForProcessExit(latestPid!);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await sleep(25);
  }
  expect(isProcessAlive(pid)).toBe(false);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
