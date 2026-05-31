import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { LspDocumentSymbol, LspHoverInfo, LspLocation, LspService } from "../src/control-plane/interfaces.js";
import {
  ATHENA_LSP_DEFINITION_TOOL,
  ATHENA_LSP_REFERENCES_TOOL,
  ATHENA_LSP_SYMBOLS_TOOL,
  createSymbolicNavigationTools
} from "../src/tools/symbolic-navigation.js";
import { resolveAgentToolset, type AgentToolSubject } from "../src/tools/index.js";

class MockLspService implements LspService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly mode: "ok" | "fail" = "ok"
  ) {}

  async getDefinition(file: string, _line: number, _character: number): Promise<LspLocation[]> {
    if (this.mode === "fail") {
      throw new Error("lsp down");
    }
    return [
      {
        uri: toFileUri(join(this.workspaceRoot, file)),
        range: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 14 }
        }
      }
    ];
  }

  async getReferences(file: string, _line: number, _character: number): Promise<LspLocation[]> {
    if (this.mode === "fail") {
      throw new Error("lsp down");
    }
    return [
      {
        uri: toFileUri(join(this.workspaceRoot, file)),
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 5 }
        }
      }
    ];
  }

  async getHoverInfo(_file: string, _line: number, _character: number): Promise<LspHoverInfo> {
    if (this.mode === "fail") {
      throw new Error("lsp down");
    }
    return { contents: "function alpha(): number" };
  }

  async getDocumentSymbols(_file: string): Promise<LspDocumentSymbol[]> {
    if (this.mode === "fail") {
      throw new Error("lsp down");
    }
    return [
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
        }
      }
    ];
  }
}

describe("symbolic navigation tools", () => {
  it("returns compact LSP-backed definition/reference/symbol results", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-symbolic-tools-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      const file = join(dir, "src", "sample.ts");
      writeFileSync(file, "function alpha() { return 1; }\nalpha();\n", "utf8");
      const tools = createSymbolicNavigationTools({
        workspaceRoot: dir,
        lspService: new MockLspService(dir, "ok")
      });

      const definition = await tools.athena_lsp_definition({
        file: "src/sample.ts",
        line: 0,
        character: 10
      });
      expect(definition.tool).toBe(ATHENA_LSP_DEFINITION_TOOL);
      expect(definition.backend).toBe("lsp");
      expect(definition.items).toHaveLength(1);

      const references = await tools.athena_lsp_references({
        file: "src/sample.ts",
        line: 1,
        character: 1
      });
      expect(references.tool).toBe(ATHENA_LSP_REFERENCES_TOOL);
      expect(references.backend).toBe("lsp");
      expect(references.items).toHaveLength(1);

      const symbols = await tools.athena_lsp_symbols({
        file: "src/sample.ts"
      });
      expect(symbols.tool).toBe(ATHENA_LSP_SYMBOLS_TOOL);
      expect(symbols.backend).toBe("lsp");
      expect(symbols.items).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to grep-style textual matches when LSP is unavailable", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-symbolic-tools-fallback-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "sample.ts"), "function alpha() { return 1; }\nalpha();\n", "utf8");
      const tools = createSymbolicNavigationTools({
        workspaceRoot: dir,
        lspService: new MockLspService(dir, "fail")
      });

      const definition = await tools.athena_lsp_definition({
        file: "src/sample.ts",
        line: 0,
        character: 10
      });
      expect(definition.backend).toBe("grep-fallback");
      expect(definition.items.length).toBeGreaterThan(0);
      expect(definition.notice).toContain("LSP unavailable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("agent toolset skill gating", () => {
  it("exposes symbolic navigation tools to agents with code-analysis skill", () => {
    const agent: AgentToolSubject = {
      skills: [{ id: "code-analysis", tags: ["review"] }]
    };
    const tools = resolveAgentToolset(agent);
    const names = tools.map((tool) => tool.name);
    expect(names).toContain(ATHENA_LSP_DEFINITION_TOOL);
    expect(names).toContain(ATHENA_LSP_REFERENCES_TOOL);
    expect(names).toContain(ATHENA_LSP_SYMBOLS_TOOL);
  });
});

function toFileUri(file: string): string {
  return pathToFileURL(file).toString();
}
