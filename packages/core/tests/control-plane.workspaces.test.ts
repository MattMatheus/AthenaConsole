import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalWorkspaceService } from "../src/control-plane/services/workspaces.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("workspace service", () => {
  it("creates, updates, lists, and deletes empty workspaces", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workspace-service-"));
    try {
      const service = new LocalWorkspaceService(loadConfig(dir));

      const created = await service.create({
        id: "workspace-alpha",
        name: "Workspace Alpha",
        slug: "workspace-alpha"
      });
      expect(created).toMatchObject({
        id: "workspace-alpha",
        name: "Workspace Alpha",
        slug: "workspace-alpha"
      });

      const updated = await service.update("workspace-alpha", {
        name: "Workspace Alpha Renamed",
        slug: "workspace-alpha-renamed"
      });
      expect(updated).toMatchObject({
        id: "workspace-alpha",
        name: "Workspace Alpha Renamed",
        slug: "workspace-alpha-renamed"
      });

      await expect(service.get("workspace-alpha")).resolves.toEqual(updated);
      await expect(service.list()).resolves.toMatchObject({
        total: 2,
        workspaces: expect.arrayContaining([
          expect.objectContaining({ id: "default" }),
          expect.objectContaining({ id: "workspace-alpha" })
        ])
      });

      await expect(service.delete("workspace-alpha")).resolves.toEqual({
        id: "workspace-alpha",
        deleted: true
      });
      await expect(service.delete("workspace-alpha")).resolves.toEqual({
        id: "workspace-alpha",
        deleted: false
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("protects the default workspace and blocks deleting workspaces with live records", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workspace-service-guards-"));
    try {
      const config = loadConfig(dir);
      const service = new LocalWorkspaceService(config);
      await service.create({
        id: "workspace-live",
        name: "Workspace Live",
        slug: "workspace-live"
      });

      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-live-workspace",
          title: "Live workspace task",
          status: "draft",
          workspaceId: "workspace-live"
        });
      } finally {
        appState.close();
      }

      await expect(service.delete("default")).rejects.toMatchObject({
        code: "CONFIG_ERROR",
        message: "The default workspace cannot be deleted."
      });
      await expect(service.delete("workspace-live")).rejects.toMatchObject({
        code: "CONFIG_ERROR",
        message: "Workspace 'workspace-live' has live records and cannot be deleted."
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
