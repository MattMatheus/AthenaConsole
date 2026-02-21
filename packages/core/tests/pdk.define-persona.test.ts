import { describe, expect, it } from "vitest";
import { definePersona } from "@athena/pdk";

describe("pdk definePersona", () => {
  it("accepts a valid persona definition", () => {
    const persona = definePersona({
      schemaVersion: 1,
      id: "code-review",
      description: "Review persona",
      context: {
        promptFiles: ["prompt.md"],
        skillFiles: ["skills.md"],
        docFiles: ["docs.md"],
        refs: [
          { kind: "prompt", path: "prompt.md" },
          { kind: "skill", path: "skills.md", required: true }
        ],
        maxFileChars: 20000,
        maxTotalChars: 120000
      },
      skills: [
        {
          id: "security-checks",
          category: "safety",
          tags: ["security", "review"]
        }
      ],
      review: {
        scope: "diff",
        maxReferencedFiles: 16,
        maxReferencedFileChars: 12000
      }
    });

    expect(persona.id).toBe("code-review");
    expect(persona.skills?.[0]?.id).toBe("security-checks");
  });

  it("rejects invalid persona id", () => {
    expect(() =>
      definePersona({
        schemaVersion: 1,
        id: "bad id"
      })
    ).toThrow(/Invalid persona id/);
  });

  it("rejects invalid context list entries", () => {
    expect(() =>
      definePersona({
        schemaVersion: 1,
        id: "good-id",
        context: {
          promptFiles: ["", "ok.md"]
        }
      })
    ).toThrow("context.promptFiles[0] must be a non-empty string.");
  });

  it("rejects invalid review bounds", () => {
    expect(() =>
      definePersona({
        schemaVersion: 1,
        id: "good-id",
        review: {
          maxReferencedFiles: 0
        }
      })
    ).toThrow("review.maxReferencedFiles must be a positive integer.");
  });

  it("rejects invalid skill definitions", () => {
    expect(() =>
      definePersona({
        schemaVersion: 1,
        id: "good-id",
        skills: [{ id: "", tags: ["ok"] }]
      })
    ).toThrow("skills[0].id must be a non-empty string.");
  });
});
