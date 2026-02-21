import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { AthenaConfig } from "../src/shared/config.js";
import { persistPersonaRunResultArtifacts } from "../src/personas/run.js";
import {
  persistPersonaRunArtifacts,
  persistPersonaRunEvidenceBundle,
  resolvePersonaRunPathsForRead
} from "../src/personas/persona-store.js";
import type { PersonaRunResult } from "../src/personas/types.js";

describe("persona artifact persistence helper", () => {
  it("persists json and markdown payloads with expected formatting", async () => {
    const persistFn = vi.fn(
      async (options: {
        config: AthenaConfig;
        runId: string;
        jsonPayload: string;
        markdownPayload: string;
        outJsonPath?: string;
        outMarkdownPath?: string;
      }) => ({
        auditDir: ".athena/specialist-runs/run-1",
        resultJsonPath: ".athena/specialist-runs/run-1/result.json",
        reportMarkdownPath: ".athena/specialist-runs/run-1/report.md",
        ...(options.outJsonPath ? { outJsonPath: options.outJsonPath } : {}),
        ...(options.outMarkdownPath ? { outMarkdownPath: options.outMarkdownPath } : {})
      })
    );
    const personaResult = {
      schemaVersion: 1,
      runId: "run-1"
    } as unknown as PersonaRunResult;

    await persistPersonaRunResultArtifacts({
      config: {} as AthenaConfig,
      runId: "run-1",
      personaResult,
      reportMarkdown: "# report\n\n",
      outJsonPath: "out/result.json",
      outMarkdownPath: "out/report.md",
      persistFn
    });

    expect(persistFn).toHaveBeenCalledTimes(1);
    const call = persistFn.mock.calls[0]![0];
    expect(call.jsonPayload.endsWith("\n")).toBe(true);
    expect(call.jsonPayload).toContain('"runId": "run-1"');
    expect(call.markdownPayload).toBe("# report\n");
    expect(call.outJsonPath).toBe("out/result.json");
    expect(call.outMarkdownPath).toBe("out/report.md");
  });

  it("persists evidence files under specialist-runs and writes legacy persona-runs copies", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-evidence-store-"));
    try {
      const config = {
        workspaceRoot: dir,
        stateDir: ".athena"
      } as AthenaConfig;

      const manifest = await persistPersonaRunEvidenceBundle({
        config,
        runId: "persona-run-1",
        attachments: [
          {
            sessionId: "s1",
            runtimeRunId: "runtime-1",
            traceId: "trace-1",
            label: "stdout",
            type: "text",
            content: "hello",
            capturedAt: "2026-02-20T00:00:00.000Z"
          },
          {
            sessionId: "s1",
            runtimeRunId: "runtime-1",
            traceId: "trace-1",
            label: "json",
            type: "json",
            content: { ok: true },
            capturedAt: "2026-02-20T00:00:01.000Z"
          }
        ]
      });

      expect(manifest).toHaveLength(2);
      const evidenceDir = join(dir, ".athena", "specialist-runs", "persona-run-1", "evidence");
      const legacyEvidenceDir = join(dir, ".athena", "persona-runs", "persona-run-1", "evidence");
      const files = readdirSync(evidenceDir).filter((name) => name.endsWith(".json"));
      const legacyFiles = readdirSync(legacyEvidenceDir).filter((name) => name.endsWith(".json"));
      expect(files.length).toBe(2);
      expect(legacyFiles.length).toBe(2);
      for (const entry of manifest) {
        expect(entry.label.length).toBeGreaterThan(0);
        const payload = readFileSync(join(dir, ".athena", entry.artifactPath), "utf8");
        const checksum = createHash("sha256").update(payload, "utf8").digest("hex");
        expect(checksum).toBe(entry.sha256);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists result/report under specialist-runs with persona-runs compatibility copies", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-artifacts-store-"));
    try {
      const config = {
        workspaceRoot: dir,
        stateDir: ".athena"
      } as AthenaConfig;

      const paths = await persistPersonaRunArtifacts({
        config,
        runId: "persona-run-2",
        jsonPayload: "{\n  \"ok\": true\n}\n",
        markdownPayload: "# report\n"
      });

      expect(paths.auditDir).toContain("/.athena/specialist-runs/persona-run-2");
      expect(readFileSync(paths.resultJsonPath, "utf8")).toContain("\"ok\": true");
      expect(readFileSync(paths.reportMarkdownPath, "utf8")).toBe("# report\n");

      const legacyResultPath = join(dir, ".athena", "persona-runs", "persona-run-2", "result.json");
      const legacyReportPath = join(dir, ".athena", "persona-runs", "persona-run-2", "report.md");
      expect(readFileSync(legacyResultPath, "utf8")).toContain("\"ok\": true");
      expect(readFileSync(legacyReportPath, "utf8")).toBe("# report\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves read paths from specialist-runs first, then falls back to persona-runs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-persona-path-resolve-"));
    try {
      const config = {
        workspaceRoot: dir,
        stateDir: ".athena"
      } as AthenaConfig;

      const legacyDir = join(dir, ".athena", "persona-runs", "run-legacy");
      const specialistDir = join(dir, ".athena", "specialist-runs", "run-new");
      mkdirSync(legacyDir, { recursive: true });
      mkdirSync(specialistDir, { recursive: true });
      writeFileSync(join(legacyDir, "result.json"), "{\n  \"kind\": \"legacy\"\n}\n", { encoding: "utf8", flag: "w" });
      writeFileSync(join(legacyDir, "report.md"), "# legacy\n", { encoding: "utf8", flag: "w" });
      writeFileSync(join(specialistDir, "result.json"), "{\n  \"kind\": \"new\"\n}\n", { encoding: "utf8", flag: "w" });
      writeFileSync(join(specialistDir, "report.md"), "# new\n", { encoding: "utf8", flag: "w" });

      const fallbackPaths = await resolvePersonaRunPathsForRead(config, "run-legacy");
      expect(fallbackPaths.auditDir).toContain("/.athena/persona-runs/run-legacy");

      const primaryPaths = await resolvePersonaRunPathsForRead(config, "run-new");
      expect(primaryPaths.auditDir).toContain("/.athena/specialist-runs/run-new");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
