import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

describe("connected repositories api", () => {
  it("creates, lists, inspects, and deletes existing-path repositories", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-connected-repo-"));
    const repoDir = join(dir, "target-repo");
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

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
      rmSync(dir, { recursive: true, force: true });
      if (message.includes("EPERM")) {
        return;
      }
      throw error;
    }
    const base = `http://${bound.host}:${bound.port}`;

    try {
      const createResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "repo-api",
          name: "API Repo",
          sourceType: "existing-path",
          workspacePath: repoDir,
          hostPath: repoDir
        })
      });
      expect(createResponse.status).toBe(200);
      const createEnvelope = (await createResponse.json()) as {
        ok: boolean;
        data: {
          id: string;
          workspacePath: string;
          hostPath?: string;
          status: string;
          dirtyState: string;
          currentBranch?: string;
          headCommit?: string;
        };
      };
      expect(createEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "repo-api",
          workspacePath: repoDir,
          hostPath: repoDir,
          status: "ready",
          dirtyState: "clean",
          currentBranch: "main"
        }
      });
      expect(createEnvelope.data.headCommit).toMatch(/^[a-f0-9]{40}$/);

      writeFileSync(join(repoDir, "notes.md"), "dirty\n", "utf8");
      const inspectResponse = await fetch(`${base}/api/v1/repositories/${encodeURIComponent("repo-api")}/inspect`, {
        method: "POST"
      });
      expect(inspectResponse.status).toBe(200);
      const inspectEnvelope = (await inspectResponse.json()) as {
        ok: boolean;
        data: { status: string; dirtyState: string; repository?: { dirtyState: string; status: string } };
      };
      expect(inspectEnvelope.data).toMatchObject({
        status: "ready",
        dirtyState: "dirty",
        repository: {
          status: "ready",
          dirtyState: "dirty"
        }
      });

      const listResponse = await fetch(`${base}/api/v1/repositories`);
      expect(listResponse.status).toBe(200);
      const listEnvelope = (await listResponse.json()) as {
        data: { total: number; repositories: Array<{ id: string }> };
      };
      expect(listEnvelope.data).toMatchObject({
        total: 1,
        repositories: [{ id: "repo-api" }]
      });

      const missingPathResponse = await fetch(`${base}/api/v1/repositories/inspect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspacePath: join(dir, "missing") })
      });
      expect(missingPathResponse.status).toBe(200);
      const missingPathEnvelope = (await missingPathResponse.json()) as {
        data: { status: string; dirtyState: string; statusMessage?: string };
      };
      expect(missingPathEnvelope.data).toMatchObject({
        status: "missing",
        dirtyState: "unknown",
        statusMessage: "Path does not exist."
      });

      const deleteResponse = await fetch(`${base}/api/v1/repositories/${encodeURIComponent("repo-api")}`, {
        method: "DELETE"
      });
      expect(deleteResponse.status).toBe(200);
      const deleteEnvelope = (await deleteResponse.json()) as { data: { id: string; deleted: boolean } };
      expect(deleteEnvelope.data).toEqual({ id: "repo-api", deleted: true });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function initGitRepo(repoDir: string): void {
  execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "athena@example.test"], { cwd: repoDir });
  execFileSync("git", ["config", "user.name", "Athena Test"], { cwd: repoDir });
  writeFileSync(join(repoDir, "README.md"), "# Test Repo\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repoDir, stdio: "ignore" });
}
