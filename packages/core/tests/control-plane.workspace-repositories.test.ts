import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("workspace-aware app-state repositories", () => {
  it("preserves workspace ids across create, list, get, and update operations", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workspace-repositories-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.tasks.create({
          id: "task-alpha",
          title: "Task Alpha",
          status: "draft",
          workspaceId: "workspace-alpha"
        });
        appState.tasks.create({
          id: "task-beta",
          title: "Task Beta",
          status: "draft",
          workspaceId: "workspace-beta"
        });
        expect(appState.tasks.get("task-alpha")?.workspaceId).toBe("workspace-alpha");
        expect(appState.tasks.update("task-alpha", { title: "Task Alpha Updated" }).workspaceId).toBe("workspace-alpha");
        expect(appState.tasks.list({ workspaceId: "workspace-alpha" }).map((task) => task.id)).toEqual(["task-alpha"]);

        appState.runs.create({
          id: "run-alpha",
          targetType: "task",
          targetId: "task-alpha",
          status: "running",
          workspaceId: "workspace-alpha"
        });
        appState.runs.create({
          id: "run-beta",
          targetType: "task",
          targetId: "task-beta",
          status: "running",
          workspaceId: "workspace-beta"
        });
        expect(appState.runs.update("run-alpha", { status: "completed" }).workspaceId).toBe("workspace-alpha");
        expect(appState.runs.list({ workspaceId: "workspace-alpha" }).map((run) => run.id)).toEqual(["run-alpha"]);

        const event = appState.runEvents.append({
          id: "event-alpha",
          runId: "run-alpha",
          taskId: "task-alpha",
          type: "run.completed",
          workspaceId: "workspace-alpha"
        });
        expect(event.workspaceId).toBe("workspace-alpha");
        expect(appState.runEvents.listForRun("run-alpha")[0]?.workspaceId).toBe("workspace-alpha");

        const artifact = appState.artifacts.create({
          id: "artifact-alpha",
          runId: "run-alpha",
          taskId: "task-alpha",
          label: "Result",
          kind: "primary",
          format: "markdown",
          storageUri: "memory://artifact-alpha",
          workspaceId: "workspace-alpha"
        });
        expect(artifact.workspaceId).toBe("workspace-alpha");
        expect(appState.artifacts.listForRun("run-alpha")[0]?.workspaceId).toBe("workspace-alpha");

        appState.connectedRepositories.create({
          id: "repo-alpha",
          name: "Repo Alpha",
          sourceType: "existing-path",
          workspacePath: "Repos/AthenaConsole",
          workspaceId: "workspace-alpha"
        });
        appState.connectedRepositories.create({
          id: "repo-beta",
          name: "Repo Beta",
          sourceType: "existing-path",
          workspacePath: "Repos/Other",
          workspaceId: "workspace-beta"
        });
        expect(appState.connectedRepositories.update("repo-alpha", { status: "ready" })?.workspaceId).toBe("workspace-alpha");
        expect(appState.connectedRepositories.list({ workspaceId: "workspace-alpha" }).map((repo) => repo.id)).toEqual(["repo-alpha"]);
        expect(
          new Set(appState.connectedRepositories.list({ workspaceIds: ["workspace-alpha", "workspace-beta"] }).map((repo) => repo.id))
        ).toEqual(new Set(["repo-alpha", "repo-beta"]));
        expect(appState.connectedRepositories.list({ workspaceIds: [] })).toEqual([]);

        appState.modelProviderConfigs.create({
          id: "provider-alpha",
          name: "Provider Alpha",
          providerKind: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          defaultModel: "gpt-fixture",
          secretRef: { kind: "env", name: "OPENAI_API_KEY" },
          workspaceId: "workspace-alpha"
        });
        appState.modelProviderConfigs.create({
          id: "provider-beta",
          name: "Provider Beta",
          providerKind: "openai-compatible",
          baseUrl: "https://example.invalid/v1",
          defaultModel: "gpt-fixture",
          secretRef: { kind: "env", name: "OPENAI_API_KEY" },
          workspaceId: "workspace-beta"
        });
        expect(appState.modelProviderConfigs.update("provider-alpha", { status: "configured" })?.workspaceId).toBe("workspace-alpha");
        expect(appState.modelProviderConfigs.list({ workspaceId: "workspace-alpha" }).map((provider) => provider.id)).toEqual([
          "provider-alpha"
        ]);
        expect(
          new Set(
            appState.modelProviderConfigs
              .list({ workspaceIds: ["workspace-alpha", "workspace-beta"] })
              .map((provider) => provider.id)
          )
        ).toEqual(new Set(["provider-alpha", "provider-beta"]));
        expect(appState.modelProviderConfigs.list({ workspaceIds: [] })).toEqual([]);

        appState.connectorCredentialBindings.upsert({
          pluginId: "plugin-alpha",
          pluginVersion: "0.1.0",
          serviceId: "service-alpha",
          bindingRef: "env:ALPHA",
          workspaceId: "workspace-alpha"
        });
        appState.connectorCredentialBindings.upsert({
          pluginId: "plugin-beta",
          pluginVersion: "0.1.0",
          serviceId: "service-beta",
          bindingRef: "env:BETA",
          workspaceId: "workspace-beta"
        });
        expect(
          appState.connectorCredentialBindings.upsert({
            pluginId: "plugin-alpha",
            pluginVersion: "0.1.0",
            serviceId: "service-alpha",
            bindingRef: "env:ALPHA_UPDATED"
          }).workspaceId
        ).toBe("workspace-alpha");
        expect(appState.connectorCredentialBindings.list({ workspaceId: "workspace-alpha" }).map((binding) => binding.pluginId)).toEqual([
          "plugin-alpha"
        ]);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores workspace members with subject lookup, role validation, uniqueness, and delete", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-workspace-members-"));
    try {
      const appState = openAppStateDatabase(loadConfig(dir));
      try {
        appState.workspaces.create({
          id: "workspace-alpha",
          name: "Workspace Alpha",
          slug: "workspace-alpha"
        });
        const created = appState.workspaceMembers.upsertMember({
          workspaceId: "workspace-alpha",
          subject: "alice",
          role: "Viewer",
          now: new Date("2026-06-16T00:00:00.000Z")
        });
        expect(created).toMatchObject({
          workspaceId: "workspace-alpha",
          subject: "alice",
          role: "Viewer"
        });

        const updated = appState.workspaceMembers.upsertMember({
          workspaceId: "workspace-alpha",
          subject: "alice",
          role: "Admin",
          now: new Date("2026-06-16T00:01:00.000Z")
        });
        expect(updated.role).toBe("Admin");
        expect(appState.workspaceMembers.listMembers("workspace-alpha")).toHaveLength(1);
        expect(appState.workspaceMembers.getMember("workspace-alpha", "alice")?.role).toBe("Admin");
        expect(appState.workspaceMembers.listMembershipsForSubject("alice").map((member) => member.workspaceId)).toEqual([
          "workspace-alpha"
        ]);

        expect(() =>
          appState.workspaceMembers.upsertMember({
            workspaceId: "workspace-alpha",
            subject: "mallory",
            role: "Owner" as "Admin"
          })
        ).toThrow(/CHECK constraint failed/);
        expect(appState.workspaceMembers.removeMember("workspace-alpha", "alice")).toBe(true);
        expect(appState.workspaceMembers.removeMember("workspace-alpha", "alice")).toBe(false);
      } finally {
        appState.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
