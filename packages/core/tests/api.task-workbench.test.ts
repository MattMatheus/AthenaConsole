import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("task workbench api", () => {
  it("creates, assigns, lists, and returns task metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-task-workbench-"));
    const config = loadConfig(dir);
    const pluginDir = join(dir, "plugin");
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "api-run.js"),
      `
const { mkdirSync, writeFileSync } = require("node:fs");
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  const envelope = JSON.parse(raw);
  mkdirSync("artifacts/api-run-1", { recursive: true });
  writeFileSync("artifacts/api-run-1/file.md", "# File Artifact\\n\\nfrom disk", "utf8");
  process.stdout.write(JSON.stringify({
    output: {
      brief: envelope.task.inputs.brief,
      taskId: envelope.task.id,
      responseMarkdown: "# API Artifact\\n\\nartifact produced"
    },
    artifacts: [
      {
        id: "artifact-good",
        label: "Good Artifact",
        kind: "primary",
        format: "markdown",
        storageUri: "memory://api-run/api-run-1/good.md"
      },
      {
        id: "artifact-file",
        label: "File Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "artifacts/api-run-1/file.md"
      },
      {
        id: "artifact-json-output",
        label: "JSON Output Artifact",
        kind: "supporting",
        format: "json",
        storageUri: "memory://api-run/api-run-1/output.json"
      },
      {
        id: "artifact-metadata-only",
        label: "Metadata Only Artifact",
        kind: "supporting",
        format: "json",
        storageUri: "memory://metadata-only/api-run-1/metadata.json",
        metadata: { metadataOnly: true }
      },
      {
        id: "artifact-missing-file",
        label: "Missing File Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "artifacts/api-run-1/missing.md"
      },
      {
        id: "artifact-unsupported",
        label: "Unsupported Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "remote://artifact-store/api-run-1/report.md"
      },
      {
        id: "artifact-blocked-file",
        label: "Blocked File Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "file:///tmp/unsafe.md"
      },
      {
        id: "artifact-traversal",
        label: "Traversal Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "memory://api-run/api-run-1/../secret.md"
      },
      {
        id: "artifact-local-traversal",
        label: "Local Traversal Artifact",
        kind: "supporting",
        format: "markdown",
        storageUri: "../secret.md"
      }
    ]
  }));
});
`,
      "utf8"
    );
    const appState = openAppStateDatabase(config);
    try {
      seedCatalog(appState, pluginDir);
    } finally {
      appState.close();
    }

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
      const metadataResponse = await fetch(`${base}/api/v1/tasks/metadata`);
      expect(metadataResponse.status).toBe(200);
      const metadataEnvelope = (await metadataResponse.json()) as {
        ok: boolean;
        data: { defaultStatus: string; readyRequiresAssignedAgent: boolean; statuses: string[]; defaultRunMode: string; runModes: string[] };
      };
      expect(metadataEnvelope.data).toMatchObject({
        defaultStatus: "draft",
        readyRequiresAssignedAgent: true,
        defaultRunMode: "read-only"
      });
      expect(metadataEnvelope.data.statuses).toContain("ready");
      expect(metadataEnvelope.data.runModes).toEqual(["read-only", "propose-changes", "approved-write"]);

      const createResponse = await fetch(`${base}/api/v1/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "task-api-draft",
          title: "API draft",
          capabilityRequirements: ["code.modify"],
          inputs: { brief: "Wire task APIs" }
        })
      });
      expect(createResponse.status).toBe(200);
      const createEnvelope = (await createResponse.json()) as {
        ok: boolean;
        data: { id: string; status: string; assignedAgentId?: string; capabilityRequirements: string[]; inputs: Record<string, unknown> };
      };
      expect(createEnvelope.ok).toBe(true);
      expect(createEnvelope.data).toMatchObject({
        id: "task-api-draft",
        status: "draft",
        capabilityRequirements: ["code.modify"],
        inputs: {
          brief: "Wire task APIs",
          runMode: "read-only"
        }
      });

      const invalidReadyResponse = await fetch(`${base}/api/v1/tasks/${encodeURIComponent("task-api-draft")}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "ready" })
      });
      expect(invalidReadyResponse.status).toBe(400);

      const readyResponse = await fetch(`${base}/api/v1/tasks/${encodeURIComponent("task-api-draft")}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "ready",
          assignedAgentId: "software.fix.local"
        })
      });
      expect(readyResponse.status).toBe(200);
      const readyEnvelope = (await readyResponse.json()) as {
        ok: boolean;
        data: { status: string; assignedAgentId?: string };
      };
      expect(readyEnvelope.data).toMatchObject({
        status: "ready",
        assignedAgentId: "software.fix.local"
      });

      const readinessResponse = await fetch(`${base}/api/v1/tasks/${encodeURIComponent("task-api-draft")}/run-readiness`);
      expect(readinessResponse.status).toBe(200);
      const readinessEnvelope = (await readinessResponse.json()) as {
        ok: boolean;
        data: { status: string; ready: boolean; checks: Array<{ id: string; status: string }> };
      };
      expect(readinessEnvelope).toMatchObject({
        ok: true,
        data: {
          status: "ready-with-warnings",
          ready: true
        }
      });
      expect(readinessEnvelope.data.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "assigned-agent", status: "ok" }),
          expect.objectContaining({ id: "runtime", status: "ok" }),
          expect.objectContaining({ id: "repo-context", status: "warning" })
        ])
      );

      const listResponse = await fetch(`${base}/api/v1/tasks?status=ready`);
      expect(listResponse.status).toBe(200);
      const listEnvelope = (await listResponse.json()) as {
        ok: boolean;
        data: { total: number; filters: { status?: string }; tasks: Array<{ id: string; status: string }> };
      };
      expect(listEnvelope.data).toMatchObject({
        total: 1,
        filters: { status: "ready" },
        tasks: [
          {
            id: "task-api-draft",
            status: "ready"
          }
        ]
      });

      const runResponse = await fetch(`${base}/api/v1/tasks/${encodeURIComponent("task-api-draft")}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: "api-run-1" })
      });
      expect(runResponse.status).toBe(200);
      const runEnvelope = (await runResponse.json()) as {
        ok: boolean;
        data: { id: string; status: string; targetId: string; output?: unknown };
      };
      expect(runEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "api-run-1",
          status: "completed",
          targetId: "task-api-draft",
          output: {
            brief: "Wire task APIs",
            taskId: "task-api-draft",
            responseMarkdown: "# API Artifact\n\nartifact produced"
          }
        }
      });

      const completedListResponse = await fetch(`${base}/api/v1/tasks?status=completed`);
      expect(completedListResponse.status).toBe(200);
      const completedListEnvelope = (await completedListResponse.json()) as {
        ok: boolean;
        data: { tasks: Array<{ id: string; latestRun?: { id: string; status: string } }> };
      };
      expect(completedListEnvelope.data.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "task-api-draft",
            latestRun: expect.objectContaining({
              id: "api-run-1",
              status: "completed"
            })
          })
        ])
      );

      const runDetailResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}`);
      expect(runDetailResponse.status).toBe(200);
      const runDetailEnvelope = (await runDetailResponse.json()) as {
        ok: boolean;
        data: {
          run: { id: string; status: string; output?: unknown };
          task?: { id: string; status: string };
          events: Array<{ type: string; message: string }>;
          artifacts: unknown[];
        };
      };
      expect(runDetailEnvelope.data).toMatchObject({
        run: {
          id: "api-run-1",
          status: "completed",
          output: {
            brief: "Wire task APIs",
            taskId: "task-api-draft",
            responseMarkdown: "# API Artifact\n\nartifact produced"
          }
        },
        task: {
          id: "task-api-draft",
          status: "completed"
        },
        artifacts: [
          expect.objectContaining({ id: "artifact-good", storageUri: "memory://api-run/api-run-1/good.md" }),
          expect.objectContaining({ id: "artifact-file", storageUri: "artifacts/api-run-1/file.md" }),
          expect.objectContaining({ id: "artifact-json-output", storageUri: "memory://api-run/api-run-1/output.json" }),
          expect.objectContaining({ id: "artifact-metadata-only", storageUri: "memory://metadata-only/api-run-1/metadata.json" }),
          expect.objectContaining({ id: "artifact-missing-file", storageUri: "artifacts/api-run-1/missing.md" }),
          expect.objectContaining({ id: "artifact-unsupported", storageUri: "remote://artifact-store/api-run-1/report.md" }),
          expect.objectContaining({ id: "artifact-blocked-file", storageUri: "file:///tmp/unsafe.md" }),
          expect.objectContaining({ id: "artifact-traversal", storageUri: "memory://api-run/api-run-1/../secret.md" }),
          expect.objectContaining({ id: "artifact-local-traversal", storageUri: "../secret.md" })
        ]
      });
      expect(runDetailEnvelope.data.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(["run.validated", "run.started", "run.log", "run.completed"])
      );

      const artifactResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-good`);
      expect(artifactResponse.status).toBe(200);
      const artifactEnvelope = (await artifactResponse.json()) as {
        ok: boolean;
        data: { id: string; content: { kind: string; text?: string; mediaType?: string } };
      };
      expect(artifactEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "artifact-good",
          content: {
            kind: "text",
            text: "# API Artifact\n\nartifact produced",
            mediaType: "text/markdown"
          }
        }
      });

      const fileArtifactResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-file`);
      expect(fileArtifactResponse.status).toBe(200);
      const fileArtifactEnvelope = (await fileArtifactResponse.json()) as {
        ok: boolean;
        data: { id: string; content: { kind: string; text?: string; mediaType?: string } };
      };
      expect(fileArtifactEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "artifact-file",
          content: {
            kind: "text",
            text: "# File Artifact\n\nfrom disk",
            mediaType: "text/markdown"
          }
        }
      });

      const jsonOutputArtifactResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-json-output`);
      expect(jsonOutputArtifactResponse.status).toBe(200);
      const jsonOutputArtifactEnvelope = (await jsonOutputArtifactResponse.json()) as {
        ok: boolean;
        data: { id: string; content: { kind: string; value?: unknown; mediaType?: string } };
      };
      expect(jsonOutputArtifactEnvelope).toMatchObject({
        ok: true,
        data: {
          id: "artifact-json-output",
          content: {
            kind: "json",
            value: {
              brief: "Wire task APIs",
              taskId: "task-api-draft",
              responseMarkdown: "# API Artifact\n\nartifact produced"
            },
            mediaType: "application/json"
          }
        }
      });

      const metadataOnlyResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-metadata-only`);
      expect(metadataOnlyResponse.status).toBe(404);
      const metadataOnlyEnvelope = (await metadataOnlyResponse.json()) as { error: { message: string } };
      expect(metadataOnlyEnvelope.error.message).toBe("Artifact artifact-metadata-only is metadata-only; no preview content was recorded.");

      const missingFileResponse = await fetch(`${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-missing-file`);
      expect(missingFileResponse.status).toBe(404);
      const missingFileEnvelope = (await missingFileResponse.json()) as { error: { message: string } };
      expect(missingFileEnvelope.error.message).toBe("Artifact file content not found for artifact-missing-file.");

      const unsupportedResponse = await fetch(
        `${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-unsupported`
      );
      expect(unsupportedResponse.status).toBe(400);
      const unsupportedEnvelope = (await unsupportedResponse.json()) as { error: { message: string } };
      expect(unsupportedEnvelope.error.message).toBe("Artifact content is not available for storage URI scheme 'remote'.");

      const blockedFileResponse = await fetch(
        `${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-blocked-file`
      );
      expect(blockedFileResponse.status).toBe(400);
      const blockedFileEnvelope = (await blockedFileResponse.json()) as { error: { message: string } };
      expect(blockedFileEnvelope.error.message).toBe("Artifact file URI must stay inside the producing plugin directory.");

      const traversalResponse = await fetch(
        `${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-traversal`
      );
      expect(traversalResponse.status).toBe(400);
      const traversalEnvelope = (await traversalResponse.json()) as { error: { message: string } };
      expect(traversalEnvelope.error.message).toBe("Artifact storageUri is not a supported memory artifact URI.");

      const localTraversalResponse = await fetch(
        `${base}/api/v1/task-runs/${encodeURIComponent("api-run-1")}/artifacts/artifact-local-traversal`
      );
      expect(localTraversalResponse.status).toBe(400);
      const localTraversalEnvelope = (await localTraversalResponse.json()) as { error: { message: string } };
      expect(localTraversalEnvelope.error.message).toBe("Artifact storageUri must stay inside the producing plugin artifacts directory.");
    } finally {
      await server.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function seedCatalog(appState: ReturnType<typeof openAppStateDatabase>, pluginDir: string): void {
  appState.plugins.upsert({
    id: "team-orchestrator.test.software",
    version: "0.1.0",
    path: pluginDir,
    enabled: true,
    status: "loaded",
    sourceType: "local",
    manifest: {
      plugin: {
        name: "Software Plugin"
      }
    },
    validationErrors: []
  });
  appState.agents.upsert({
    id: "software.fix.local",
    version: "1.0.0",
    pluginId: "team-orchestrator.test.software",
    pluginVersion: "0.1.0",
    name: "Software Fixer",
    capabilities: ["code.modify", "text.summarize"],
    status: "loaded",
    manifest: {
      agent: {
        inputs: {
          brief: {
            type: "markdown",
            required: true
          }
        },
        implementation: {
          type: "local-command",
          command: process.execPath,
          args: ["api-run.js"]
        },
        runtime: {
          preferredBackend: "local-process",
          workingDirectory: "."
        }
      }
    }
  });
}
