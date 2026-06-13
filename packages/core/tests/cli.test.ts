import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { openAppStateDatabase } from "../src/control-plane/app-state/index.js";
import { LocalEventService } from "../src/control-plane/services/event-dlq.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

describe("CLI", () => {
  it("returns version", async () => {
    const out = await runCli(["--version"]);
    expect(out).toBe("projectathena 0.1.0");
  });

  it("runs a turn and persists session artifacts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-"));

    try {
      const out = await runCli(["run", "--session", "s1", "--input", "hello"], { cwd: dir });
      const parsed = JSON.parse(out) as { output: string; sessionId: string; evidenceCount?: number };

      expect(parsed.sessionId).toBe("s1");
      expect(parsed.output).toContain("Echo: user: hello");
      expect(parsed.evidenceCount).toBe(0);

      const sessionPath = join(dir, ".athena", "sessions", "s1.json");
      const transcriptPath = join(dir, ".athena", "transcripts", "s1.jsonl");

      expect(existsSync(sessionPath)).toBe(true);
      expect(existsSync(transcriptPath)).toBe(true);

      const transcriptLines = readFileSync(transcriptPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      expect(transcriptLines.length).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns not-running for cancel requests without an active run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-cancel-"));
    try {
      const out = await runCli(["cancel", "--session", "s1"], { cwd: dir });
      const parsed = JSON.parse(out) as { sessionId: string; status: string };
      expect(parsed.sessionId).toBe("s1");
      expect(parsed.status).toBe("not-running");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports task-run evidence bundles from the CLI", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-task-run-bundle-"));
    try {
      const config = loadConfig(dir);
      const appState = openAppStateDatabase(config);
      try {
        appState.tasks.create({
          id: "task-cli-bundle",
          title: "CLI bundle task",
          status: "completed",
          assignedAgentId: "agent.cli",
          inputs: {
            apiToken: "sk-cli-secret"
          }
        });
        appState.runs.create({
          id: "cli-run-1",
          targetType: "task",
          targetId: "task-cli-bundle",
          status: "completed",
          backend: "local-process",
          agentId: "agent.cli",
          output: { ok: true }
        });
        appState.runEvents.append({
          id: "event-cli-run-completed",
          runId: "cli-run-1",
          taskId: "task-cli-bundle",
          agentId: "agent.cli",
          type: "run.completed",
          level: "info",
          message: "Run completed.",
          payload: {}
        });
      } finally {
        appState.close();
      }

      const out = await runCli(["task-run", "evidence-bundle", "--run", "cli-run-1"], { cwd: dir });
      const parsed = JSON.parse(out) as {
        manifest: {
          schemaVersion: string;
          bundleId: string;
          run: { task?: { inputs?: Record<string, unknown> } };
          redaction: { redactedFields: string[] };
        };
        events: Array<{ event: { type: string } }>;
      };

      expect(parsed.manifest.schemaVersion).toBe("team-orchestrator.evidence-bundle.v1");
      expect(parsed.manifest.bundleId).toBe("evidence-bundle-cli-run-1");
      expect(parsed.manifest.run.task?.inputs?.apiToken).toBe("[redacted]");
      expect(parsed.manifest.redaction.redactedFields).toContain("manifest.run.task.inputs.apiToken");
      expect(parsed.events.map((event) => event.event.type)).toContain("run.completed");
      expect(out).not.toContain("sk-cli-secret");
      const auditEvents = await new LocalEventService(config).list({ types: ["evidence-bundle.exported"], limit: 5 });
      expect(auditEvents.events).toEqual([
        expect.objectContaining({
          type: "evidence-bundle.exported",
          runId: "cli-run-1",
          taskId: "task-cli-bundle",
          payload: expect.objectContaining({
            bundleId: "evidence-bundle-cli-run-1",
            destinationKind: "cli-stdout"
          })
        })
      ]);
      expect(JSON.stringify(auditEvents.events[0])).not.toContain("sk-cli-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns clear errors for malformed template param flags", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-template-param-errors-"));
    try {
      await expect(runCli(["run", "--template", "rt-1", "--param", "HEAD_REF"], { cwd: dir })).rejects.toThrow(
        "Invalid --param 'HEAD_REF'. Expected key=value."
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs run/cancel through API client transport when configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-api-transport-"));
    try {
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
        const baseUrl = `http://${bound.host}:${bound.port}`;
        const runOut = await runCli(
          [
            "run",
            "--session",
            "s1",
            "--input",
            "hello over api",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const runParsed = JSON.parse(runOut) as { sessionId: string; output: string };
        expect(runParsed.sessionId).toBe("s1");
        expect(runParsed.output).toContain("Echo: user: hello over api");

        const cancelOut = await runCli(
          ["cancel", "--session", "s1", "--transport", "api", "--api-base-url", baseUrl, "--reason", "test"],
          { cwd: dir }
        );
        const cancelParsed = JSON.parse(cancelOut) as { sessionId: string; status: string };
        expect(cancelParsed.sessionId).toBe("s1");
        expect(cancelParsed.status).toBe("not-running");
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to local transport in auto mode on API transport failures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-auto-fallback-"));
    try {
      const out = await runCli(
        [
          "run",
          "--session",
          "s1",
          "--input",
          "hello fallback",
          "--transport",
          "auto",
          "--api-base-url",
          "http://127.0.0.1:1",
          "--api-timeout-ms",
          "200"
        ],
        { cwd: dir }
      );
      const parsed = JSON.parse(out) as { sessionId: string; output: string };
      expect(parsed.sessionId).toBe("s1");
      expect(parsed.output).toContain("Echo: user: hello fallback");
      expect(existsSync(join(dir, ".athena", "sessions", "s1.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs template-based turns with param overrides and persists audit metadata", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-template-run-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const profile = await services.harnessProfileService.create({
        displayName: "Template Runner",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 2,
          budgetUsd: 2
        }
      });
      const template = await services.runTemplateService.create({
        harnessProfileId: profile.id,
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParams: {
          HEAD_REF: "main",
          BASE_REF: "origin/main"
        }
      });

      const out = await runCli(["run", "--template", template.id, "--param", "HEAD_REF=feature/seed"], { cwd: dir });
      const parsed = JSON.parse(out) as {
        sessionId: string;
        output: string;
        directiveId?: string;
        harnessProfileId?: string;
        template?: { id: string; effectiveParams: Record<string, string> };
      };
      expect(parsed.template?.id).toBe(template.id);
      expect(parsed.directiveId).toBeDefined();
      expect(parsed.harnessProfileId).toBe(profile.id);
      expect(parsed.template?.effectiveParams).toEqual({
        HEAD_REF: "feature/seed",
        BASE_REF: "origin/main"
      });
      expect(parsed.output).toContain("feature/seed");

      const transcriptPath = join(dir, ".athena", "transcripts", `${parsed.sessionId}.jsonl`);
      const transcriptLines = readFileSync(transcriptPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { metadata?: Record<string, string> });
      expect(transcriptLines[1]?.metadata?.["requestMeta.templateId"]).toBe(template.id);
      expect(transcriptLines[1]?.metadata?.["requestMeta.templateEffectiveParams"]).toBe(
        JSON.stringify({
          HEAD_REF: "feature/seed",
          BASE_REF: "origin/main"
        })
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes machine-readable API contract artifacts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-api-contracts-"));
    try {
      const out = await runCli(["api", "contracts"], { cwd: dir });
      const parsed = JSON.parse(out) as { status: string; path: string; routeCount: number };
      expect(parsed.status).toBe("written");
      expect(parsed.routeCount).toBeGreaterThan(0);
      expect(existsSync(parsed.path)).toBe(true);
      const contract = JSON.parse(readFileSync(parsed.path, "utf8")) as {
        schemaVersion: number;
        apiVersion: string;
        openapi?: { openapi?: string };
      };
      expect(contract.schemaVersion).toBe(2);
      expect(contract.apiVersion).toBe("v1");
      expect(contract.openapi?.openapi).toBe("3.1.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs template-based turns through API transport", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-cli-template-api-"));
    try {
      const config = loadConfig(dir);
      const services = createLocalControlPlaneServices({ config });
      const profile = await services.harnessProfileService.create({
        displayName: "Template API Runner",
        version: "v1",
        config: {
          provider: "mock",
          model: "mock-model",
          tools: ["review"]
        },
        policies: {
          timeoutMs: 30_000,
          retryLimit: 2,
          budgetUsd: 2
        }
      });
      const template = await services.runTemplateService.create({
        harnessProfileId: profile.id,
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParams: {
          HEAD_REF: "main",
          BASE_REF: "origin/main"
        }
      });
      const server = createApiServer({
        config,
        services,
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
        const baseUrl = `http://${bound.host}:${bound.port}`;
        const out = await runCli(
          [
            "run",
            "--template",
            template.id,
            "--param",
            "HEAD_REF=feature/api",
            "--transport",
            "api",
            "--api-base-url",
            baseUrl
          ],
          { cwd: dir }
        );
        const parsed = JSON.parse(out) as {
          directiveId?: string;
          harnessProfileId?: string;
          template?: { id: string; effectiveParams: Record<string, string> };
          output: string;
        };
        expect(parsed.template?.id).toBe(template.id);
        expect(parsed.directiveId).toBeDefined();
        expect(parsed.harnessProfileId).toBe(profile.id);
        expect(parsed.template?.effectiveParams).toEqual({
          HEAD_REF: "feature/api",
          BASE_REF: "origin/main"
        });
        expect(parsed.output).toContain("feature/api");
      } finally {
        await server.stop();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
