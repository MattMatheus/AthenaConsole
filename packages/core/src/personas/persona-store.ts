import { createHash, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { mkdir, rename, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { AthenaConfig } from "../shared/config.js";
import { AthenaError } from "../runtime/errors.js";
import { acquireSessionLock } from "../runtime/session-lock.js";
import type { PersonaEvidenceManifestEntry } from "./types.js";

export interface PersonaRunPaths {
  auditDir: string;
  resultJsonPath: string;
  reportMarkdownPath: string;
}

export interface PersonaEvidenceAttachment {
  sessionId: string;
  runtimeRunId: string;
  traceId: string;
  label: string;
  type: "text" | "json" | "binary";
  content: string | unknown;
  metadata?: Record<string, string>;
  capturedAt: string;
}

const SPECIALIST_RUNS_DIR = "specialist-runs";
const PERSONA_RUNS_DIR = "persona-runs";

export function resolvePersonaRunPaths(config: AthenaConfig, runId: string): PersonaRunPaths {
  const stateRoot = resolve(config.workspaceRoot, config.stateDir);
  const auditDir = resolve(stateRoot, SPECIALIST_RUNS_DIR, runId);
  const resultJsonPath = resolve(auditDir, "result.json");
  const reportMarkdownPath = resolve(auditDir, "report.md");
  return {
    auditDir,
    resultJsonPath,
    reportMarkdownPath
  };
}

function resolveLegacyPersonaRunPaths(config: AthenaConfig, runId: string): PersonaRunPaths {
  const stateRoot = resolve(config.workspaceRoot, config.stateDir);
  const auditDir = resolve(stateRoot, PERSONA_RUNS_DIR, runId);
  const resultJsonPath = resolve(auditDir, "result.json");
  const reportMarkdownPath = resolve(auditDir, "report.md");
  return {
    auditDir,
    resultJsonPath,
    reportMarkdownPath
  };
}

export async function resolvePersonaRunPathsForRead(config: AthenaConfig, runId: string): Promise<PersonaRunPaths> {
  const primary = resolvePersonaRunPaths(config, runId);
  try {
    await access(primary.resultJsonPath);
    return primary;
  } catch {
    return resolveLegacyPersonaRunPaths(config, runId);
  }
}

function resolvePersonaEvidenceDir(config: AthenaConfig, runId: string): string {
  return resolve(resolvePersonaRunPaths(config, runId).auditDir, "evidence");
}

function resolveLegacyPersonaEvidenceDir(config: AthenaConfig, runId: string): string {
  return resolve(resolveLegacyPersonaRunPaths(config, runId).auditDir, "evidence");
}

function assertPathWithin(baseDir: string, candidate: string): void {
  const rel = relative(baseDir, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new AthenaError("SESSION_IO_ERROR", `Resolved path escapes state directory: ${candidate}`);
  }
}

export function resolveWorkspaceRelative(workspaceRoot: string, userPath: string): string {
  if (isAbsolute(userPath)) {
    throw new AthenaError("CONFIG_ERROR", `Output path must be workspace-relative: ${userPath}`);
  }
  const resolved = resolve(workspaceRoot, userPath);
  assertPathWithin(workspaceRoot, resolved);
  return resolved;
}

async function atomicWriteFile(path: string, payload: string): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(tmpPath, payload, "utf8");
  await rename(tmpPath, path);
  await rm(tmpPath, { force: true });
}

function toSerializableEvidenceContent(attachment: PersonaEvidenceAttachment): unknown {
  if (attachment.type === "text") {
    return {
      kind: "text",
      text: typeof attachment.content === "string" ? attachment.content : String(attachment.content)
    };
  }
  if (attachment.type === "binary") {
    return {
      kind: "binary",
      base64: typeof attachment.content === "string" ? attachment.content : String(attachment.content)
    };
  }
  return {
    kind: "json",
    value: attachment.content
  };
}

function computeSha256(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export async function persistPersonaRunEvidenceBundle(options: {
  config: AthenaConfig;
  runId: string;
  attachments: PersonaEvidenceAttachment[];
}): Promise<PersonaEvidenceManifestEntry[]> {
  const evidenceDir = resolvePersonaEvidenceDir(options.config, options.runId);
  const legacyEvidenceDir = resolveLegacyPersonaEvidenceDir(options.config, options.runId);
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(legacyEvidenceDir, { recursive: true });
  assertPathWithin(resolve(options.config.workspaceRoot, options.config.stateDir), evidenceDir);
  assertPathWithin(resolve(options.config.workspaceRoot, options.config.stateDir), legacyEvidenceDir);

  const lockPath = resolve(evidenceDir, "evidence.lock");
  const lock = await acquireSessionLock(lockPath, {
    timeoutMs: 5_000,
    retryDelayMs: 20
  });
  try {
    const manifest: PersonaEvidenceManifestEntry[] = [];
    for (const attachment of options.attachments) {
      const id = randomUUID();
      const artifactPath = resolve(evidenceDir, `${id}.json`);
      const legacyArtifactPath = resolve(legacyEvidenceDir, `${id}.json`);
      assertPathWithin(evidenceDir, artifactPath);
      assertPathWithin(legacyEvidenceDir, legacyArtifactPath);
      const record = {
        schemaVersion: 1,
        id,
        sessionId: attachment.sessionId,
        runtimeRunId: attachment.runtimeRunId,
        traceId: attachment.traceId,
        label: attachment.label,
        type: attachment.type,
        ...(attachment.metadata ? { metadata: attachment.metadata } : {}),
        createdAt: attachment.capturedAt,
        content: toSerializableEvidenceContent(attachment)
      };
      const payload = `${JSON.stringify(record, null, 2)}\n`;
      await atomicWriteFile(artifactPath, payload);
      await atomicWriteFile(legacyArtifactPath, payload);
      const relArtifactPath = relative(resolve(options.config.workspaceRoot, options.config.stateDir), artifactPath);
      manifest.push({
        id,
        label: attachment.label,
        sha256: computeSha256(payload),
        artifactPath: relArtifactPath,
        type: attachment.type,
        sizeBytes: Buffer.byteLength(payload, "utf8"),
        createdAt: attachment.capturedAt
      });
    }
    return manifest;
  } finally {
    await lock.release();
  }
}

export async function persistPersonaRunArtifacts(options: {
  config: AthenaConfig;
  runId: string;
  jsonPayload: string;
  markdownPayload: string;
  outJsonPath?: string;
  outMarkdownPath?: string;
}): Promise<PersonaRunPaths & { outJsonPath?: string; outMarkdownPath?: string }> {
  const paths = resolvePersonaRunPaths(options.config, options.runId);
  const legacyPaths = resolveLegacyPersonaRunPaths(options.config, options.runId);

  // Ensure the audit bundle is always written under `.athena/` for replay/debugging.
  await mkdir(paths.auditDir, { recursive: true });
  await mkdir(legacyPaths.auditDir, { recursive: true });
  assertPathWithin(resolve(options.config.workspaceRoot, options.config.stateDir), paths.auditDir);
  assertPathWithin(resolve(options.config.workspaceRoot, options.config.stateDir), legacyPaths.auditDir);

  await atomicWriteFile(paths.resultJsonPath, options.jsonPayload);
  await atomicWriteFile(paths.reportMarkdownPath, options.markdownPayload);
  await atomicWriteFile(legacyPaths.resultJsonPath, options.jsonPayload);
  await atomicWriteFile(legacyPaths.reportMarkdownPath, options.markdownPayload);

  if (options.outJsonPath) {
    const outPath = resolveWorkspaceRelative(options.config.workspaceRoot, options.outJsonPath);
    await mkdir(dirname(outPath), { recursive: true });
    await copyFile(paths.resultJsonPath, outPath);
  }

  if (options.outMarkdownPath) {
    const outPath = resolveWorkspaceRelative(options.config.workspaceRoot, options.outMarkdownPath);
    await mkdir(dirname(outPath), { recursive: true });
    await copyFile(paths.reportMarkdownPath, outPath);
  }

  return {
    ...paths,
    ...(options.outJsonPath ? { outJsonPath: resolveWorkspaceRelative(options.config.workspaceRoot, options.outJsonPath) } : {}),
    ...(options.outMarkdownPath
      ? { outMarkdownPath: resolveWorkspaceRelative(options.config.workspaceRoot, options.outMarkdownPath) }
      : {})
  };
}
