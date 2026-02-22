import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadPersonaDefinition } from "../src/personas/loader.js";
import { assemblePersonaContextPack } from "../src/personas/context-pack.js";

function writePersonaDefinition(root: string, payload: Record<string, unknown>): void {
  const personaDir = join(root, "specialists", "code-review");
  mkdirSync(personaDir, { recursive: true });
  writeFileSync(join(personaDir, "manifest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

describe("persona context pack", () => {
  it("assembles prompt/skill/doc files in deterministic order with manifest entries", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-context-"));

    try {
      const root = join(dir, "specialists", "code-review");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "p1.md"), "Prompt 1", "utf8");
      writeFileSync(join(root, "p2.md"), "Prompt 2", "utf8");
      writeFileSync(join(root, "skill.md"), "Skill", "utf8");
      writeFileSync(join(root, "doc.md"), "Doc", "utf8");

      writePersonaDefinition(dir, {
        schemaVersion: 1,
        id: "code-review",
        context: {
          promptFiles: ["p1.md", "p2.md"],
          skillFiles: ["skill.md"],
          docFiles: ["doc.md"]
        }
      });

      const persona = await loadPersonaDefinition(dir, "code-review");
      const pack = await assemblePersonaContextPack({ workspaceRoot: dir, persona });

      expect(pack.manifest.entries.map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
        "prompt:p1.md",
        "prompt:p2.md",
        "skill:skill.md",
        "doc:doc.md"
      ]);
      expect(pack.systemContent.indexOf("Prompt File: p1.md")).toBeLessThan(pack.systemContent.indexOf("Prompt File: p2.md"));
      expect(pack.systemContent.indexOf("Prompt File: p2.md")).toBeLessThan(pack.systemContent.indexOf("Skill File: skill.md"));
      expect(pack.userContent).toContain("Doc File: doc.md");
      expect(pack.manifest.totals.requestedFiles).toBe(4);
      expect(pack.manifest.totals.loadedFiles).toBe(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when curated context file is missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-context-missing-"));

    try {
      mkdirSync(join(dir, "specialists", "code-review"), { recursive: true });
      writePersonaDefinition(dir, {
        schemaVersion: 1,
        id: "code-review",
        context: {
          promptFiles: ["missing.md"]
        }
      });

      const persona = await loadPersonaDefinition(dir, "code-review");
      await expect(assemblePersonaContextPack({ workspaceRoot: dir, persona })).rejects.toThrow(
        "Persona context file missing or unreadable"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects context paths that escape persona root", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-context-escape-"));

    try {
      mkdirSync(join(dir, "specialists", "code-review"), { recursive: true });
      writePersonaDefinition(dir, {
        schemaVersion: 1,
        id: "code-review",
        context: {
          promptFiles: ["../outside.md"]
        }
      });

      const persona = await loadPersonaDefinition(dir, "code-review");
      await expect(assemblePersonaContextPack({ workspaceRoot: dir, persona })).rejects.toThrow(
        "Persona context path escapes"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records truncation markers when file and total budgets are hit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-context-trunc-"));

    try {
      const root = join(dir, "specialists", "code-review");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "prompt.md"), "12345678901234567890", "utf8");
      writeFileSync(join(root, "doc.md"), "abcdefghijabcdefghij", "utf8");
      writePersonaDefinition(dir, {
        schemaVersion: 1,
        id: "code-review",
        context: {
          promptFiles: ["prompt.md"],
          docFiles: ["doc.md"],
          maxFileChars: 12,
          maxTotalChars: 50
        }
      });

      const persona = await loadPersonaDefinition(dir, "code-review");
      const pack = await assemblePersonaContextPack({ workspaceRoot: dir, persona });

      expect(pack.systemContent).toContain("[truncated to 12 chars: prompt.md]");
      expect(pack.userContent).toContain("[truncated:");
      expect(pack.manifest.totals.truncatedFiles).toBeGreaterThan(0);
      expect(pack.manifest.entries.some((entry) => entry.truncationReason === "max-file-chars")).toBe(true);
      expect(pack.manifest.entries.some((entry) => entry.truncationReason === "max-total-chars")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads workspace doc files into curated doc context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-context-workspace-doc-"));

    try {
      const root = join(dir, "specialists", "code-review");
      mkdirSync(root, { recursive: true });
      mkdirSync(join(dir, "planning", "prompts", "active"), { recursive: true });
      writeFileSync(join(root, "prompt.md"), "Prompt", "utf8");
      writeFileSync(join(dir, "planning", "prompts", "active", "next-agent-seed-prompt.md"), "Seed", "utf8");
      writePersonaDefinition(dir, {
        schemaVersion: 1,
        id: "code-review",
        context: {
          promptFiles: ["prompt.md"],
          workspaceDocFiles: ["planning/prompts/active/next-agent-seed-prompt.md"]
        }
      });

      const persona = await loadPersonaDefinition(dir, "code-review");
      const pack = await assemblePersonaContextPack({ workspaceRoot: dir, persona });

      expect(pack.userContent).toContain("Doc File: workspace:planning/prompts/active/next-agent-seed-prompt.md");
      expect(pack.userContent).toContain("Seed");
      expect(pack.manifest.entries.map((entry) => `${entry.kind}:${entry.path}`)).toEqual([
        "prompt:prompt.md",
        "doc:workspace:planning/prompts/active/next-agent-seed-prompt.md"
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
