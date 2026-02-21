import { describe, expect, it } from "vitest";
import { constructPersonaReviewPrompt } from "../src/personas/run.js";
import type { PersonaContextPack } from "../src/personas/context-pack.js";
import type { PersonaDefinition, ReferencedFileSnapshot } from "../src/personas/types.js";

function buildPersona(overrides: Partial<PersonaDefinition> = {}): PersonaDefinition {
  return {
    schemaVersion: 1,
    id: "code-review",
    ...overrides
  };
}

function buildContextPack(overrides: Partial<PersonaContextPack> = {}): PersonaContextPack {
  return {
    systemContent: "SYSTEM-CONTEXT",
    userContent: "USER-CONTEXT",
    manifest: {
      schemaVersion: 1,
      personaId: "code-review",
      personaRoot: "/tmp/specialists/code-review",
      limits: { maxFileChars: 100, maxTotalChars: 200 },
      totals: { requestedFiles: 1, loadedFiles: 1, loadedChars: 42, truncatedFiles: 0 },
      entries: []
    },
    ...overrides
  };
}

function buildSnapshot(overrides: Partial<ReferencedFileSnapshot> = {}): ReferencedFileSnapshot {
  return {
    sourcePath: "src/a.ts",
    importSpecifier: "./b",
    path: "src/b.ts",
    chars: 12,
    truncated: false,
    content: "export const b = 1;",
    ...overrides
  };
}

describe("persona prompt construction", () => {
  it("constructs review prompt with manifest summary and referenced snapshots", () => {
    const prompt = constructPersonaReviewPrompt({
      persona: buildPersona({ review: { rubric: { security: true } } }),
      contextPack: buildContextPack(),
      repoPath: "/repo",
      headRef: "feature",
      baseRef: "main",
      changedFiles: ["src/a.ts"],
      diff: "diff --git a/src/a.ts b/src/a.ts",
      dependencyInspection: { status: "ok", notes: ["deps"] },
      referencedSnapshots: [buildSnapshot()]
    });

    expect(prompt).toContain("Curated persona context manifest summary:");
    expect(prompt).toContain('"personaId": "code-review"');
    expect(prompt).toContain("Compare: main..feature");
    expect(prompt).toContain("Changed files (bounded):\nsrc/a.ts");
    expect(prompt).toContain("Referenced TS/JS file snapshots");
    expect(prompt).toContain("from: src/a.ts");
    expect(prompt).toContain("import: ./b");
    expect(prompt).toContain("resolved: src/b.ts");
    expect(prompt).toContain("export const b = 1;");
  });

  it("renders '(none)' when there are no referenced snapshots", () => {
    const prompt = constructPersonaReviewPrompt({
      persona: buildPersona(),
      contextPack: buildContextPack({ systemContent: "", userContent: "" }),
      repoPath: "/repo",
      headRef: "feature",
      baseRef: "main",
      changedFiles: [],
      diff: "diff",
      dependencyInspection: { status: "skipped" },
      referencedSnapshots: []
    });

    expect(prompt).toContain("Changed files (bounded):\n(none)");
    expect(prompt).toContain("Referenced TS/JS file snapshots from newly introduced relative imports (bounded):\n(none)");
  });
});
