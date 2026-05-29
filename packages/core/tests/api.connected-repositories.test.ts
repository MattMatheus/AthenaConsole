import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

describe("connected repositories api", () => {
  it("creates managed clones from local Git sources and records failed clones", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-managed-repo-"));
    const sourceRepoDir = join(dir, "source-repo");
    mkdirSync(sourceRepoDir, { recursive: true });
    initGitRepo(sourceRepoDir);

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
      const cloneResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "repo-managed",
          name: "Managed Repo",
          sourceType: "managed-clone",
          remoteUrl: sourceRepoDir
        })
      });
      expect(cloneResponse.status).toBe(200);
      const cloneEnvelope = (await cloneResponse.json()) as {
        data: {
          id: string;
          sourceType: string;
          workspacePath: string;
          remoteUrl?: string;
          status: string;
          dirtyState: string;
          currentBranch?: string;
        };
      };
      expect(cloneEnvelope.data).toMatchObject({
        id: "repo-managed",
        sourceType: "managed-clone",
        remoteUrl: sourceRepoDir,
        status: "ready",
        dirtyState: "clean",
        currentBranch: "main"
      });
      expect(cloneEnvelope.data.workspacePath).toBe(join(dir, "repos", "managed", "repo-managed"));

      const escapedIdResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "../repo-escape",
          name: "Managed Repo Escape",
          sourceType: "managed-clone",
          remoteUrl: sourceRepoDir
        })
      });
      expect(escapedIdResponse.status).toBe(200);
      const escapedIdEnvelope = (await escapedIdResponse.json()) as {
        data: { id: string; workspacePath: string; status: string };
      };
      expect(escapedIdEnvelope.data).toMatchObject({
        id: "../repo-escape",
        workspacePath: join(dir, "repos", "managed", "repo-escape"),
        status: "ready"
      });

      const unsupportedSourceResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "repo-ssh",
          name: "Managed Repo SSH",
          sourceType: "managed-clone",
          remoteUrl: "git@example.test:team/repo.git"
        })
      });
      expect(unsupportedSourceResponse.status).toBe(400);

      const duplicateResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "repo-managed",
          name: "Managed Repo Again",
          sourceType: "managed-clone",
          remoteUrl: sourceRepoDir
        })
      });
      expect(duplicateResponse.status).toBe(400);

      const failedCloneResponse = await fetch(`${base}/api/v1/repositories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "repo-managed-fail",
          name: "Managed Repo Fail",
          sourceType: "managed-clone",
          remoteUrl: join(dir, "missing-source")
        })
      });
      expect(failedCloneResponse.status).toBe(200);
      const failedCloneEnvelope = (await failedCloneResponse.json()) as {
        data: { id: string; status: string; dirtyState: string; statusMessage?: string };
      };
      expect(failedCloneEnvelope.data).toMatchObject({
        id: "repo-managed-fail",
        status: "error",
        dirtyState: "unknown"
      });
      expect(failedCloneEnvelope.data.statusMessage).toContain("Git clone failed");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
