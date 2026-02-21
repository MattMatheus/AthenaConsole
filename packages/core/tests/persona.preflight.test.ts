import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runPreflightChecks, validateModelOutputFindings } from "../src/personas/run.js";
import type { PersonaModelOutputV1 } from "../src/personas/types.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writePersona(dir: string) {
  mkdirSync(join(dir, "specialists", "code-review"), { recursive: true });
  writeFileSync(
    join(dir, "specialists", "code-review", "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "code-review",
        git: { baseRefDefault: "main", requireCleanWorktree: true, baseRefAutodetect: true },
        output: { stdoutDefault: "summary" }
      },
      null,
      2
    ),
    "utf8"
  );
}

function buildModelOutput(overrides: Partial<PersonaModelOutputV1> = {}): PersonaModelOutputV1 {
  return {
    schemaVersion: 1,
    mergeGate: "pass",
    reportMarkdown: "# Report",
    findings: [],
    ...overrides
  };
}

describe("persona run preflight checks", () => {
  it("loads persona and resolves refs for a valid repository", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-preflight-ok-"));
    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);
      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello preflight\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const preflight = await runPreflightChecks(
        {
          name: "code-review",
          repoPath: ".",
          headRef: "feature"
        },
        dir
      );

      expect(preflight.persona.id).toBe("code-review");
      expect(preflight.baseResolution.baseRef).toBe("main");
      expect(preflight.baseResolution.resolvedFrom).toBe("main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails preflight when repository has uncommitted changes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-preflight-dirty-"));
    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);
      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "dirty\n", "utf8");

      await expect(
        runPreflightChecks(
          {
            name: "code-review",
            repoPath: ".",
            headRef: "feature"
          },
          dir
        )
      ).rejects.toThrow("uncommitted changes");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("persona model output finding validation", () => {
  it("enforces mergeGate fail when a P1 finding is present", () => {
    const parsed = buildModelOutput({
      mergeGate: "pass",
      findings: [{ priority: "P1", confidence: 0.8, title: "critical", message: "needs fix now" }]
    });

    const validation = validateModelOutputFindings(parsed);

    expect(validation.error).toBe("Model output mergeGate must be 'fail' when any P1 finding exists.");
  });

  it("normalizes confidence into [0, 1]", () => {
    const parsed = buildModelOutput({
      mergeGate: "pass",
      findings: [{ priority: "P3", confidence: 5, title: "nit", message: "minor cleanup" }]
    });

    const validation = validateModelOutputFindings(parsed);

    expect(validation.error).toBeUndefined();
    expect(validation.findings?.[0]?.confidence).toBe(1);
  });
});
