import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { LspDocumentSymbol, LspHoverInfo, LspLocation, LspService } from "../src/control-plane/interfaces.js";
import { collectReferencedFileSnapshots } from "../src/personas/referenced-snapshots.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

class StubLspService implements LspService {
  constructor(private readonly mode: "ok" | "fail") {}

  async getDefinition(_file: string, _line: number, _character: number): Promise<LspLocation[]> {
    return [];
  }

  async getReferences(_file: string, _line: number, _character: number): Promise<LspLocation[]> {
    return [];
  }

  async getHoverInfo(_file: string, _line: number, _character: number): Promise<LspHoverInfo | undefined> {
    return undefined;
  }

  async getDocumentSymbols(_file: string): Promise<LspDocumentSymbol[]> {
    if (this.mode === "fail") {
      throw new Error("lsp unavailable");
    }
    return [
      {
        name: "lib",
        kind: 11,
        detail: "interface",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 3, character: 1 }
        },
        selectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 3 }
        },
        children: [
          {
            name: "run",
            kind: 6,
            detail: "() => number",
            range: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 24 }
            },
            selectionRange: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 5 }
            }
          }
        ]
      }
    ];
  }
}

describe("referenced file snapshots", () => {
  it("loads snapshots for newly introduced relative TS/JS imports", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-ref-snapshots-"));

    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);

      writeFileSync(join(dir, "src", "lib.ts"), "export const lib = 1;\n", "utf8");
      writeFileSync(join(dir, "src", "main.ts"), "export const run = () => 1;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(
        join(dir, "src", "main.ts"),
        "import { lib } from './lib';\nexport const run = () => lib;\n",
        "utf8"
      );
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "add import"]);

      const diff = git(dir, ["diff", "--unified=3", "main..feature"]);
      const result = await collectReferencedFileSnapshots({
        repoPath: dir,
        headRef: "feature",
        diff,
        maxReferencedFiles: 8,
        maxReferencedFileChars: 500
      });

      expect(result.meta.attemptedImports).toBe(1);
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0]?.path).toBe("src/lib.ts");
      expect(result.snapshots[0]?.content).toContain("export const lib");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores non-relative imports", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-ref-snapshots-nonrel-"));

    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);

      writeFileSync(join(dir, "src", "main.ts"), "export const run = () => 1;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "src", "main.ts"), "import x from 'lodash';\nexport const run = () => x;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "add non-relative import"]);

      const diff = git(dir, ["diff", "--unified=3", "main..feature"]);
      const result = await collectReferencedFileSnapshots({ repoPath: dir, headRef: "feature", diff });

      expect(result.meta.attemptedImports).toBe(0);
      expect(result.snapshots).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("respects per-file char cap and truncation metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-ref-snapshots-trunc-"));

    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);

      writeFileSync(join(dir, "src", "lib.ts"), "export const big = '" + "x".repeat(200) + "';\n", "utf8");
      writeFileSync(join(dir, "src", "main.ts"), "export const run = () => 1;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "src", "main.ts"), "import { big } from './lib';\nexport const run = () => big;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "add import"]);

      const diff = git(dir, ["diff", "--unified=3", "main..feature"]);
      const result = await collectReferencedFileSnapshots({
        repoPath: dir,
        headRef: "feature",
        diff,
        maxReferencedFiles: 4,
        maxReferencedFileChars: 40
      });

      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0]?.truncated).toBe(true);
      expect(result.snapshots[0]?.content).toContain("[file truncated to 40 chars]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("compacts referenced file content into symbolic signatures when strategy is enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-ref-snapshots-symbolic-"));

    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);

      writeFileSync(
        join(dir, "src", "lib.ts"),
        "export interface lib {\n  run: () => number;\n}\n\n" + "export const noise = 1;\n".repeat(120),
        "utf8"
      );
      writeFileSync(join(dir, "src", "main.ts"), "export const run = () => 1;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "src", "main.ts"), "import { lib } from './lib';\nexport const run = () => lib;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "add import"]);

      const diff = git(dir, ["diff", "--unified=3", "main..feature"]);
      const result = await collectReferencedFileSnapshots({
        repoPath: dir,
        headRef: "feature",
        diff,
        contextStrategy: "symbolic-signatures",
        lspService: new StubLspService("ok"),
        maxReferencedFiles: 4,
        maxReferencedFileChars: 200
      });

      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0]?.contentFormat).toBe("symbolic-signatures");
      expect(result.snapshots[0]?.content).toContain("[symbolic-signatures]");
      expect(result.snapshots[0]?.content).toContain("Interface lib");
      expect(result.snapshots[0]?.content).toContain("lib.run");
      expect(result.snapshots[0]?.content).not.toContain("export const noise");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to full file snapshots when symbolic signature extraction fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-ref-snapshots-symbolic-fallback-"));

    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);

      writeFileSync(join(dir, "src", "lib.ts"), "export const lib = 1;\n", "utf8");
      writeFileSync(join(dir, "src", "main.ts"), "export const run = () => 1;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "src", "main.ts"), "import { lib } from './lib';\nexport const run = () => lib;\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "add import"]);

      const diff = git(dir, ["diff", "--unified=3", "main..feature"]);
      const result = await collectReferencedFileSnapshots({
        repoPath: dir,
        headRef: "feature",
        diff,
        contextStrategy: "symbolic-signatures",
        lspService: new StubLspService("fail")
      });

      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0]?.contentFormat).toBe("full");
      expect(result.snapshots[0]?.content).toContain("export const lib = 1;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
