import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { loadConfig } from "../src/shared/config.js";

describe("workspace api", () => {
  it("creates, lists, updates, reads, and deletes workspaces", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workspaces-"));
    const server = createApiServer({
      config: loadConfig(dir),
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
      const createResponse = await fetch(`${base}/api/v1/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "workspace-api",
          name: "API Workspace",
          slug: "workspace-api"
        })
      });
      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as { data: { id: string; name: string; slug: string } };
      expect(created.data).toMatchObject({
        id: "workspace-api",
        name: "API Workspace",
        slug: "workspace-api"
      });

      const listResponse = await fetch(`${base}/api/v1/workspaces`);
      expect(listResponse.status).toBe(200);
      const listed = (await listResponse.json()) as { data: { total: number; workspaces: Array<{ id: string }> } };
      expect(listed.data.total).toBe(2);
      expect(listed.data.workspaces.map((workspace) => workspace.id)).toEqual(
        expect.arrayContaining(["default", "workspace-api"])
      );

      const updateResponse = await fetch(`${base}/api/v1/workspaces/${encodeURIComponent("workspace-api")}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Renamed API Workspace",
          slug: "renamed-api-workspace"
        })
      });
      expect(updateResponse.status).toBe(200);
      const updated = (await updateResponse.json()) as { data: { id: string; name: string; slug: string } };
      expect(updated.data).toMatchObject({
        id: "workspace-api",
        name: "Renamed API Workspace",
        slug: "renamed-api-workspace"
      });

      const getResponse = await fetch(`${base}/api/v1/workspaces/${encodeURIComponent("workspace-api")}`);
      expect(getResponse.status).toBe(200);
      const got = (await getResponse.json()) as { data: { id: string; slug: string } };
      expect(got.data).toMatchObject({
        id: "workspace-api",
        slug: "renamed-api-workspace"
      });

      const deleteDefaultResponse = await fetch(`${base}/api/v1/workspaces/default`, {
        method: "DELETE"
      });
      expect(deleteDefaultResponse.status).toBe(400);

      const deleteResponse = await fetch(`${base}/api/v1/workspaces/${encodeURIComponent("workspace-api")}`, {
        method: "DELETE"
      });
      expect(deleteResponse.status).toBe(200);
      const deleted = (await deleteResponse.json()) as { data: { id: string; deleted: boolean } };
      expect(deleted.data).toEqual({
        id: "workspace-api",
        deleted: true
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("allows Admins to manage workspace members and denies non-Admins", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-workspace-members-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_API_TOKEN=",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=admin-user:Admin,viewer-user:Viewer"
      ].join("\n"),
      "utf8"
    );
    const server = createApiServer({
      config: loadConfig(dir),
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
      const createResponse = await fetch(`${base}/api/v1/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-athena-identity": "admin-user" },
        body: JSON.stringify({
          id: "workspace-members-api",
          name: "Members API Workspace",
          slug: "workspace-members-api"
        })
      });
      expect(createResponse.status).toBe(200);

      const viewerDenied = await fetch(`${base}/api/v1/workspaces/workspace-members-api/members`, {
        headers: { "x-athena-identity": "viewer-user" }
      });
      expect(viewerDenied.status).toBe(403);

      const upsertResponse = await fetch(
        `${base}/api/v1/workspaces/workspace-members-api/members/${encodeURIComponent(" operator-user ")}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json", "x-athena-identity": "admin-user" },
          body: JSON.stringify({ role: "Operator" })
        }
      );
      expect(upsertResponse.status).toBe(200);
      const upserted = (await upsertResponse.json()) as { data: { workspaceId: string; subject: string; role: string } };
      expect(upserted.data).toMatchObject({
        workspaceId: "workspace-members-api",
        subject: "operator-user",
        role: "Operator"
      });

      const listResponse = await fetch(`${base}/api/v1/workspaces/workspace-members-api/members`, {
        headers: { "x-athena-identity": "admin-user" }
      });
      expect(listResponse.status).toBe(200);
      const listed = (await listResponse.json()) as { data: { total: number; members: Array<{ subject: string }> } };
      expect(listed.data.total).toBe(1);
      expect(listed.data.members.map((member) => member.subject)).toEqual(["operator-user"]);

      const deleteResponse = await fetch(`${base}/api/v1/workspaces/workspace-members-api/members/operator-user`, {
        method: "DELETE",
        headers: { "x-athena-identity": "admin-user" }
      });
      expect(deleteResponse.status).toBe(200);
      const deleted = (await deleteResponse.json()) as { data: { deleted: boolean; subject: string } };
      expect(deleted.data).toEqual({
        workspaceId: "workspace-members-api",
        subject: "operator-user",
        deleted: true
      });
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
