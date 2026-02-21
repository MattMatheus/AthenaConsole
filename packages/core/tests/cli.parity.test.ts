import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { runCli } from "../src/cli/index.js";
import { loadConfig } from "../src/shared/config.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspace(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

function normalizeRunOutput(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  const row = value as {
    sessionId?: string;
    output?: string;
    model?: string;
    provider?: string;
    usage?: unknown;
  };
  return {
    sessionId: row.sessionId,
    output: row.output,
    model: row.model,
    provider: row.provider,
    usage: row.usage ?? null
  };
}

async function runApiCliInWorkspace(dir: string, args: string[]): Promise<string | undefined> {
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
      return undefined;
    }
    throw error;
  }

  try {
    const baseUrl = `http://${bound.host}:${bound.port}`;
    return await runCli([...args, "--transport", "api", "--api-base-url", baseUrl], { cwd: dir });
  } finally {
    await server.stop();
  }
}

describe("CLI transport parity", () => {
  it("keeps run/cancel JSON surfaces aligned between local and API transports", async () => {
    const localDir = makeWorkspace("athena-cli-parity-run-local-");
    const apiDir = makeWorkspace("athena-cli-parity-run-api-");

    const localRun = JSON.parse(
      await runCli(["run", "--session", "s1", "--input", "hello parity"], { cwd: localDir })
    ) as unknown;
    const apiRunRaw = await runApiCliInWorkspace(apiDir, ["run", "--session", "s1", "--input", "hello parity"]);
    if (!apiRunRaw) {
      return;
    }
    const apiRun = JSON.parse(apiRunRaw) as unknown;

    expect(normalizeRunOutput(apiRun)).toEqual(normalizeRunOutput(localRun));

    const localCancel = JSON.parse(await runCli(["cancel", "--session", "s1"], { cwd: localDir })) as unknown;
    const apiCancelRaw = await runApiCliInWorkspace(apiDir, ["cancel", "--session", "s1"]);
    if (!apiCancelRaw) {
      return;
    }
    const apiCancel = JSON.parse(apiCancelRaw) as unknown;
    expect(apiCancel).toEqual(localCancel);
  });

  it("keeps work enqueue/status/drain JSON surfaces aligned between local and API transports", async () => {
    const localDir = makeWorkspace("athena-cli-parity-work-local-");
    const apiDir = makeWorkspace("athena-cli-parity-work-api-");

    const localEnqueue = JSON.parse(
      await runCli(["work", "enqueue", "--session", "s1", "--input", "hello parity", "--mode", "followup"], {
        cwd: localDir
      })
    ) as unknown;
    const apiEnqueueRaw = await runApiCliInWorkspace(apiDir, [
      "work",
      "enqueue",
      "--session",
      "s1",
      "--input",
      "hello parity",
      "--mode",
      "followup"
    ]);
    if (!apiEnqueueRaw) {
      return;
    }
    const apiEnqueue = JSON.parse(apiEnqueueRaw) as unknown;
    expect(apiEnqueue).toEqual(localEnqueue);

    const localStatus = JSON.parse(await runCli(["work", "status", "--session", "s1"], { cwd: localDir })) as unknown;
    const apiStatusRaw = await runApiCliInWorkspace(apiDir, ["work", "status", "--session", "s1"]);
    if (!apiStatusRaw) {
      return;
    }
    const apiStatus = JSON.parse(apiStatusRaw) as unknown;
    expect(apiStatus).toEqual(localStatus);

    const localDrain = JSON.parse(await runCli(["work", "drain", "--session", "s1"], { cwd: localDir })) as unknown;
    const apiDrainRaw = await runApiCliInWorkspace(apiDir, ["work", "drain", "--session", "s1"]);
    if (!apiDrainRaw) {
      return;
    }
    const apiDrain = JSON.parse(apiDrainRaw) as unknown;
    expect(apiDrain).toEqual(localDrain);
  });

  it("keeps memory search/get JSON surfaces aligned between local and API transports", async () => {
    const localDir = makeWorkspace("athena-cli-parity-memory-local-");
    const apiDir = makeWorkspace("athena-cli-parity-memory-api-");

    for (const dir of [localDir, apiDir]) {
      mkdirSync(join(dir, "memory"), { recursive: true });
      writeFileSync(join(dir, ".env"), "ATHENA_MEMORY_ENABLED=true\n", "utf8");
      writeFileSync(join(dir, "MEMORY.md"), "athena parity memory\nsecond line\n", "utf8");
      writeFileSync(join(dir, "memory", "notes.md"), "line 1\nline 2\nline 3\n", "utf8");
    }

    const localSearch = JSON.parse(await runCli(["memory", "search", "--query", "athena"], { cwd: localDir })) as unknown;
    const apiSearchRaw = await runApiCliInWorkspace(apiDir, ["memory", "search", "--query", "athena"]);
    if (!apiSearchRaw) {
      return;
    }
    const apiSearch = JSON.parse(apiSearchRaw) as unknown;
    expect(apiSearch).toEqual(localSearch);

    const localGet = JSON.parse(
      await runCli(["memory", "get", "--path", "memory/notes.md", "--from", "2", "--lines", "2"], { cwd: localDir })
    ) as unknown;
    const apiGetRaw = await runApiCliInWorkspace(apiDir, [
      "memory",
      "get",
      "--path",
      "memory/notes.md",
      "--from",
      "2",
      "--lines",
      "2"
    ]);
    if (!apiGetRaw) {
      return;
    }
    const apiGet = JSON.parse(apiGetRaw) as unknown;
    expect(apiGet).toEqual(localGet);
  });
});
