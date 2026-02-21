import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

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

describe("CLI specialist commands", () => {
  it("scaffolds a specialist via init and validates it immediately", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-init-"));

    try {
      const initOut = await runCli(["specialist", "init", "security-auditor"], {
        cwd: dir,
        specialistPrompt: {
          ask: async (question: string, defaultValue: string) => {
            if (question.includes("primary role")) {
              return "Security reviewer";
            }
            if (question.includes("primary objective")) {
              return "Review diffs for security regressions.";
            }
            return defaultValue;
          }
        }
      });
      const initResult = JSON.parse(initOut) as { status: string; name: string; files: string[] };
      expect(initResult.status).toBe("ok");
      expect(initResult.name).toBe("security-auditor");
      expect(initResult.files.length).toBe(5);

      expect(existsSync(join(dir, "specialists", "security-auditor", "manifest.json"))).toBe(true);
      expect(existsSync(join(dir, "specialists", "security-auditor", "prompt.md"))).toBe(true);
      expect(existsSync(join(dir, "specialists", "security-auditor", "skills.md"))).toBe(true);
      expect(existsSync(join(dir, "specialists", "security-auditor", "docs.md"))).toBe(true);
      expect(existsSync(join(dir, "specialists", "security-auditor", "tests", "manifest.spec.ts"))).toBe(true);

      const validateOut = await runCli(["specialist", "validate", "security-auditor"], { cwd: dir });
      const validateResult = JSON.parse(validateOut) as { status: string; action: string; contextFiles: number };
      expect(validateResult.status).toBe("ok");
      expect(validateResult.action).toBe("specialist.validate");
      expect(validateResult.contextFiles).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails init when scaffold files already exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-init-existing-"));

    try {
      mkdirSync(join(dir, "specialists", "security-auditor"), { recursive: true });
      writeFileSync(join(dir, "specialists", "security-auditor", "manifest.json"), "{}\n", "utf8");

      await expect(
        runCli(["specialist", "init", "security-auditor", "--role", "Security reviewer", "--description", "Review code"], { cwd: dir })
      ).rejects.toThrow("Refusing to overwrite existing persona scaffold files");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs code-review specialist and persists audit bundle outputs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-"));

    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello world\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const out = await runCli(
        ["specialist", "run", "--name", "code-review", "--repo", ".", "--head", "feature", "--stdout", "json"],
        { cwd: dir }
      );
      const parsed = JSON.parse(out) as {
        status: string;
        mergeGate: "pass" | "fail";
        modelOutputParsed: boolean;
        artifacts: { resultJsonPath: string; reportMarkdownPath: string };
      };

      expect(parsed.status).toBe("ok");
      expect(parsed.mergeGate).toBe("pass");
      expect(parsed.modelOutputParsed).toBe(true);
      expect(existsSync(parsed.artifacts.resultJsonPath)).toBe(true);
      expect(existsSync(parsed.artifacts.reportMarkdownPath)).toBe(true);

      const persisted = JSON.parse(readFileSync(parsed.artifacts.resultJsonPath, "utf8")) as { schemaVersion: number; personaName: string };
      expect(persisted.schemaVersion).toBe(1);
      expect(persisted.personaName).toBe("code-review");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aborts review when repository has uncommitted changes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-dirty-"));

    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "dirty\n", "utf8"); // not committed

      await expect(
        runCli(["specialist", "run", "--name", "code-review", "--repo", ".", "--head", "feature"], { cwd: dir })
      ).rejects.toThrow("uncommitted changes");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("auto-detects base branch via origin/HEAD when main is not present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-origin-head-"));
    const remote = join(dir, "remote.git");

    try {
      writePersona(dir);
      git(dir, ["init", "-b", "trunk"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      mkdirSync(remote, { recursive: true });
      git(remote, ["init", "--bare"]);

      git(dir, ["remote", "add", "origin", remote]);
      git(dir, ["push", "-q", "-u", "origin", "trunk"]);
      // Set origin/HEAD explicitly so refs/remotes/origin/HEAD exists for autodetection.
      git(remote, ["symbolic-ref", "HEAD", "refs/heads/trunk"]);
      git(dir, ["fetch", "origin"]);
      git(dir, ["remote", "set-head", "origin", "trunk"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello trunk feature\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const out = await runCli(
        ["specialist", "run", "--name", "code-review", "--repo", ".", "--head", "feature", "--stdout", "json"],
        { cwd: dir }
      );
      const parsed = JSON.parse(out) as { baseRefResolvedFrom: string; baseRef: string };
      expect(parsed.baseRefResolvedFrom).toBe("origin-head");
      expect(parsed.baseRef).toContain("origin/");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retries once with repair prompt when initial model output is invalid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-repair-"));
    const repairScript = join(dir, "repair-provider.js");
    const counterFile = join(dir, "provider-count.txt");

    try {
      writePersona(dir);
      writeFileSync(
        repairScript,
        [
          "const fs = require('node:fs');",
          "const counterPath = process.argv[2] || '';",
          "const input = process.argv[3] || '';",
          "const inputLower = input.toLowerCase();",
          "let count = 0;",
          "if (counterPath && fs.existsSync(counterPath)) count = Number(fs.readFileSync(counterPath, 'utf8')) || 0;",
          "count += 1;",
          "if (counterPath) fs.writeFileSync(counterPath, String(count));",
          "if (inputLower.includes('previous response was invalid json')) {",
          "  process.stdout.write(JSON.stringify({ schemaVersion: 1, mergeGate: 'pass', reportMarkdown: '# repaired', findings: [], dependencyInspection: { status: 'skipped', notes: ['repair'] } }));",
          "} else {",
          "  process.stdout.write('not-json');",
          "}"
        ].join("\n"),
        "utf8"
      );
      writeFileSync(counterFile, "0", "utf8");
      writeFileSync(
        join(dir, ".env"),
        [
          "ATHENA_DEFAULT_PROVIDER=local-exec",
          "ATHENA_LOCAL_PROVIDER_CMD=node",
          `ATHENA_LOCAL_PROVIDER_ARGS=${repairScript},${counterFile}`
        ].join("\n"),
        "utf8"
      );

      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);
      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello repaired\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const out = await runCli(
        ["specialist", "run", "--name", "code-review", "--repo", ".", "--head", "feature", "--stdout", "json"],
        { cwd: dir }
      );
      const parsed = JSON.parse(out) as { status: string; modelOutputParsed: boolean; parseRetryAttempted: boolean };
      const callCount = Number(readFileSync(counterFile, "utf8"));

      expect(parsed.status).toBe("ok");
      expect(parsed.modelOutputParsed).toBe(true);
      expect(parsed.parseRetryAttempted).toBe(true);
      expect(callCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs specialist via API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-persona-api-"));

    try {
      writePersona(dir);
      git(dir, ["init", "-b", "main"]);
      git(dir, ["config", "user.email", "athena@example.com"]);
      git(dir, ["config", "user.name", "Athena"]);
      writeFileSync(join(dir, "a.txt"), "hello\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "init"]);

      git(dir, ["checkout", "-q", "-b", "feature"]);
      writeFileSync(join(dir, "a.txt"), "hello api persona\n", "utf8");
      git(dir, ["add", "."]);
      git(dir, ["commit", "-m", "change"]);

      const config = loadConfig(dir);
      const server = createApiServer({
        config,
        host: "127.0.0.1",
        port: 0
      });
      let bound: { host: string; port: number };
      try {
        bound = await server.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }

      try {
        const out = await runCli(
          [
            "specialist",
            "run",
            "--name",
            "code-review",
            "--repo",
            ".",
            "--head",
            "feature",
            "--stdout",
            "json",
            "--transport",
            "api",
            "--api-base-url",
            `http://${bound.host}:${bound.port}`
          ],
          { cwd: dir }
        );
        const parsed = JSON.parse(out) as { status: string; modelOutputParsed: boolean };
        expect(parsed.status).toBe("ok");
        expect(parsed.modelOutputParsed).toBe(true);
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
