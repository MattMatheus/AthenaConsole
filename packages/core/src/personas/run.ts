import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute, relative } from "node:path";
import { promisify } from "node:util";
import type { LspService } from "../control-plane/interfaces.js";
import type { AthenaConfig } from "../shared/config.js";
import { createRuntime } from "../runtime/index.js";
import { AthenaError } from "../runtime/errors.js";
import { createMemoryManager } from "../memory/index.js";
import { loadPersonaDefinition } from "./loader.js";
import { assemblePersonaContextPack, type PersonaContextPack } from "./context-pack.js";
import {
  assertCleanWorktree,
  assertGitRepo,
  assertRefExists,
  getDiff,
  listChangedFiles,
  listWorktreeChangedFiles,
  resolveBaseRef
} from "./git.js";
import { inspectDependenciesBestEffort } from "./dependency-inspection.js";
import { collectReferencedFileSnapshots } from "./referenced-snapshots.js";
import {
  persistPersonaRunArtifacts,
  persistPersonaRunEvidenceBundle,
  resolvePersonaRunPaths,
  resolveWorkspaceRelative,
  type PersonaEvidenceAttachment
} from "./persona-store.js";
import { resolvePersonaToolset } from "../tools/index.js";
import type {
  DependencyInspection,
  PersonaDefinition,
  PersonaModelOutputV1,
  PersonaEvidenceManifestEntry,
  PersonaRunResult,
  PersonaOutputStdout,
  ReferencedFileSnapshot
} from "./types.js";
import type { RuntimeEvidenceAttachment } from "../runtime/index.js";

const execFileAsync = promisify(execFile);

const PERSONA_RUN_SCHEMA_VERSION = 1;
const MODEL_OUTPUT_REPAIR_MAX_CHARS = 40_000;

function safeId(prefix: string): string {
  const ts = Date.now();
  const rand = randomUUID().slice(0, 8);
  return `${prefix}-${ts}-${rand}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(1, Math.max(0, num));
}

function normalizeJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

export function validateModelOutputFindings(parsed: PersonaModelOutputV1): { findings?: PersonaModelOutputV1["findings"]; error?: string } {
  if (!Array.isArray(parsed.findings)) {
    return { error: "Model output missing findings array." };
  }
  for (const finding of parsed.findings) {
    if (!finding || typeof finding !== "object") {
      return { error: "Model output findings contained a non-object entry." };
    }
    if (!("priority" in finding) || !("confidence" in finding) || !("title" in finding) || !("message" in finding)) {
      return { error: "Model output finding missing required fields." };
    }
    const priority = (finding as { priority: unknown }).priority;
    if (priority !== "P1" && priority !== "P2" && priority !== "P3") {
      return { error: "Model output finding priority must be one of P1|P2|P3." };
    }
    if (typeof (finding as { title: unknown }).title !== "string" || typeof (finding as { message: unknown }).message !== "string") {
      return { error: "Model output finding title/message must be strings." };
    }
    const confidence = (finding as { confidence: unknown }).confidence;
    if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
      return { error: "Model output finding confidence must be a finite number." };
    }
  }

  const findings = parsed.findings.map((finding) => ({
    ...finding,
    confidence: clampConfidence((finding as { confidence: unknown }).confidence)
  }));
  const hasP1 = findings.some((finding) => finding.priority === "P1");
  if (hasP1 && parsed.mergeGate !== "fail") {
    return { error: "Model output mergeGate must be 'fail' when any P1 finding exists." };
  }
  return { findings };
}

function parsePersonaModelOutput(raw: string): { parsed?: PersonaModelOutputV1; error?: string } {
  try {
    const parsed = JSON.parse(normalizeJsonCandidate(raw)) as PersonaModelOutputV1;
    if (!parsed || typeof parsed !== "object") {
      return { error: "Model output was not a JSON object." };
    }
    if (parsed.schemaVersion !== 1) {
      return { error: "Model output schemaVersion missing or unsupported." };
    }
    if (parsed.mergeGate !== "pass" && parsed.mergeGate !== "fail") {
      return { error: "Model output missing mergeGate ('pass'|'fail')." };
    }
    if (typeof parsed.reportMarkdown !== "string") {
      return { error: "Model output missing reportMarkdown string." };
    }
    const findingsValidation = validateModelOutputFindings(parsed);
    if (findingsValidation.error) {
      return { error: findingsValidation.error };
    }
    parsed.findings = findingsValidation.findings ?? [];
    return { parsed };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

interface ImplementationToolStep {
  schemaVersion: 1;
  action: "tool";
  tool: string;
  input?: Record<string, unknown>;
  rationale?: string;
}

interface ImplementationFinalStep extends PersonaModelOutputV1 {
  action: "final";
}

type ImplementationStep = ImplementationToolStep | ImplementationFinalStep;

function parseImplementationStep(raw: string): { step?: ImplementationStep; error?: string } {
  try {
    const parsed = JSON.parse(normalizeJsonCandidate(raw)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return { error: "Implementation step was not a JSON object." };
    }
    if (parsed.schemaVersion !== 1) {
      return { error: "Implementation step schemaVersion missing or unsupported." };
    }
    const action = parsed.action;
    if (action === "tool") {
      if (typeof parsed.tool !== "string" || !parsed.tool.trim()) {
        return { error: "Implementation tool step missing non-empty tool name." };
      }
      const topLevelInput = Object.entries(parsed).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (key === "schemaVersion" || key === "action" || key === "tool" || key === "input" || key === "rationale") {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {});
      const normalizedInput =
        parsed.input && typeof parsed.input === "object"
          ? (parsed.input as Record<string, unknown>)
          : Object.keys(topLevelInput).length > 0
            ? topLevelInput
            : undefined;
      return {
        step: {
          schemaVersion: 1,
          action: "tool",
          tool: parsed.tool,
          ...(normalizedInput ? { input: normalizedInput } : {}),
          ...(typeof parsed.rationale === "string" ? { rationale: parsed.rationale } : {})
        }
      };
    }
    if (action === "final") {
      const finalParsed = parsePersonaModelOutput(raw);
      if (finalParsed.error || !finalParsed.parsed) {
        return { error: finalParsed.error ?? "Invalid final output payload." };
      }
      return {
        step: {
          ...finalParsed.parsed,
          action: "final"
        }
      };
    }
    return { error: "Implementation step action must be 'tool' or 'final'." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function buildRepairPrompt(rawOutput: string, parseError: string): string {
  return [
    "Your previous response was invalid JSON for the required schema.",
    `Validation error: ${parseError}`,
    "Return ONLY strict JSON (no markdown fences, no commentary) that conforms exactly to:",
    JSON.stringify(
      {
        schemaVersion: 1,
        mergeGate: "pass|fail",
        reportMarkdown: "string",
        findings: [
          {
            priority: "P1|P2|P3",
            confidence: 0.0,
            title: "short title",
            message: "one paragraph explanation",
            suggestion: "optional concrete suggestion",
            file: "optional path",
            line: 0
          }
        ],
        dependencyInspection: {
          status: "ok|skipped",
          notes: ["optional notes"]
        }
      },
      null,
      2
    ),
    "",
    "Constraint: mergeGate MUST be 'fail' when any finding priority is P1.",
    "",
    "Previous invalid response:",
    rawOutput.slice(0, MODEL_OUTPUT_REPAIR_MAX_CHARS),
    ...(rawOutput.length > MODEL_OUTPUT_REPAIR_MAX_CHARS ? [`\n[truncated to ${MODEL_OUTPUT_REPAIR_MAX_CHARS} chars]\n`] : [])
  ].join("\n");
}

function buildImplementationStepRepairPrompt(rawOutput: string, parseError: string): string {
  return [
    "Your previous response was invalid for implementation-step schema.",
    `Validation error: ${parseError}`,
    "Return ONLY strict JSON with one of the following shapes:",
    JSON.stringify(
      {
        schemaVersion: 1,
        action: "tool",
        tool: "read_file|list_dir|run_exec|memory_search|memory_get",
        input: { example: "tool arguments object" },
        rationale: "optional short reason"
      },
      null,
      2
    ),
    JSON.stringify(
      {
        schemaVersion: 1,
        action: "final",
        mergeGate: "pass|fail",
        reportMarkdown: "string",
        findings: [
          {
            priority: "P1|P2|P3",
            confidence: 0,
            title: "string",
            message: "string",
            suggestion: "optional",
            file: "optional",
            line: 1
          }
        ],
        dependencyInspection: { status: "ok|skipped", notes: [] }
      },
      null,
      2
    ),
    "",
    "Previous invalid response:",
    rawOutput.slice(0, MODEL_OUTPUT_REPAIR_MAX_CHARS)
  ].join("\n");
}

function isPathWithin(baseDir: string, candidate: string): boolean {
  const rel = relative(baseDir, candidate);
  return rel !== ".." && !rel.startsWith(`..${"/"}`) && !isAbsolute(rel);
}

function normalizeToolPath(repoPath: string, rawPath: unknown): string {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    throw new AthenaError("CONFIG_ERROR", "Tool path must be a non-empty string.");
  }
  const abs = resolve(repoPath, rawPath);
  if (!isPathWithin(repoPath, abs)) {
    throw new AthenaError("CONFIG_ERROR", `Tool path escapes repository root: ${rawPath}`);
  }
  return abs;
}

function parseInteger(value: unknown, fallback: number, min = 1, max = 1_000_000): number {
  const raw = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

async function executeImplementationTool(options: {
  step: ImplementationToolStep;
  repoPath: string;
  config: AthenaConfig;
}): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  const input = options.step.input ?? {};
  try {
    if (options.step.tool === "read_file") {
      const path = normalizeToolPath(options.repoPath, input.path);
      const maxChars = parseInteger(input.maxChars, 20_000, 256, 200_000);
      const content = await readFile(path, "utf8");
      return {
        ok: true,
        output: {
          path: relative(options.repoPath, path) || ".",
          truncated: content.length > maxChars,
          content: content.length > maxChars ? `${content.slice(0, maxChars)}\n\n[truncated to ${maxChars} chars]\n` : content
        }
      };
    }
    if (options.step.tool === "list_dir") {
      const path = normalizeToolPath(options.repoPath, input.path ?? ".");
      const maxEntries = parseInteger(input.maxEntries, 200, 1, 2_000);
      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(path, { withFileTypes: true });
      return {
        ok: true,
        output: entries.slice(0, maxEntries).map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other"
        }))
      };
    }
    if (options.step.tool === "run_exec") {
      const command = typeof input.command === "string" ? input.command.trim() : "";
      if (!command) {
        throw new AthenaError("CONFIG_ERROR", "run_exec requires 'command'.");
      }
      const args = Array.isArray(input.args) ? input.args.map((value) => String(value)) : [];
      const cwd = normalizeToolPath(options.repoPath, input.cwd ?? ".");
      const timeoutMs = parseInteger(input.timeoutMs, 60_000, 1_000, 600_000);
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024
      });
      return {
        ok: true,
        output: {
          command,
          args,
          cwd: relative(options.repoPath, cwd) || ".",
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? "")
        }
      };
    }
    if (options.step.tool === "memory_search") {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      if (!query) {
        throw new AthenaError("CONFIG_ERROR", "memory_search requires non-empty 'query'.");
      }
      const manager = createMemoryManager(options.config);
      const results = await manager.search(query, {
        maxResults: parseInteger(input.maxResults, 6, 1, 50),
        minScore: typeof input.minScore === "number" ? input.minScore : undefined
      });
      return { ok: true, output: results };
    }
    if (options.step.tool === "memory_get") {
      const manager = createMemoryManager(options.config);
      const path = typeof input.path === "string" ? input.path : "";
      const result = await manager.get({
        path,
        from: parseInteger(input.from, 1, 1, 1_000_000),
        lines: parseInteger(input.lines, 120, 1, 2_000)
      });
      return { ok: true, output: result };
    }
    return { ok: false, error: `Unsupported tool '${options.step.tool}'.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function buildReviewPrompt(options: {
  personaContextSystem: string;
  personaContextUser: string;
  contextManifestSummary: string;
  availableTools: Array<{ name: string; description: string }>;
  persona: PersonaDefinition;
  repoPath: string;
  headRef: string;
  baseRef: string;
  changedFiles: string[];
  diff: string;
  dependencyInspection: unknown;
  referencedFileContext: string;
  activeStoryPath?: string;
}): string {
  const rubric = options.persona.review?.rubric ?? {
    correctness: true,
    security: true,
    performance: true,
    maintainability: true,
    testGaps: true
  };
  const reviewScope = options.persona.review?.scope ?? "diff";
  const isImplementationScope = reviewScope === "implementation";
  const systemRole = isImplementationScope ? "Athena's implementation specialist." : "Athena's code review persona.";
  const modeRule = isImplementationScope
    ? "- Perform implementation directly using available tools; do not stay in review-only mode when actionable work exists."
    : "- Suggestions only. Do not claim to have applied changes.";
  const priorityRule = isImplementationScope
    ? "- Use priority P1 for blocked or missing required delivery; P2 for partial acceptance coverage; P3 for minor follow-ups."
    : "- Use priority P1 for critical correctness/security issues; P2 for important maintainability/test gaps; P3 for nits/nice-to-haves.";
  const reportRule = isImplementationScope
    ? "- reportMarkdown must describe implementation status, files changed (or still required), tests run, and handoff readiness."
    : undefined;

  return [
    "SYSTEM:",
    `You are ${systemRole}`,
    "Return ONLY strict JSON that conforms to this schema (no markdown outside JSON):",
    JSON.stringify(
      {
        schemaVersion: 1,
        mergeGate: "pass|fail",
        reportMarkdown: "string (Markdown report for humans)",
        findings: [
          {
            priority: "P1|P2|P3",
            confidence: 0.0,
            title: "short title",
            message: "one paragraph explanation",
            suggestion: "optional concrete suggestion",
            file: "optional path",
            line: 0
          }
        ],
        dependencyInspection: {
          status: "ok|skipped",
          notes: ["optional notes"]
        }
      },
      null,
      2
    ),
    "",
    "Rules:",
    modeRule,
    priorityRule,
    "- Confidence must be a float in [0,1].",
    "- mergeGate MUST be 'fail' when any P1 finding exists.",
    "- If dependency inspection cannot be performed, set dependencyInspection.status='skipped' and explain in notes.",
    ...(reportRule ? [reportRule] : []),
    "",
    "Curated persona context manifest summary:",
    options.contextManifestSummary,
    "",
    ...(options.personaContextSystem
      ? ["Curated system context (prompt + skill files, ordered):", options.personaContextSystem, ""]
      : []),
    "Available tools:",
    ...(options.availableTools.length > 0
      ? options.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`)
      : ["(none)"]),
    "",
    "USER:",
    `Repo: ${options.repoPath}`,
    `Compare: ${options.baseRef}..${options.headRef}`,
    "",
    "Execution preflight:",
    ...(options.activeStoryPath
      ? [
          `- Actionable backlog story detected: ${options.activeStoryPath}`,
          "- Treat queue as non-empty and execute delivery unless explicitly blocked."
        ]
      : ["- No actionable backlog story detected by runtime preflight."]),
    "",
    ...(options.personaContextUser ? ["Curated user context (doc files, ordered):", options.personaContextUser, ""] : []),
    "Rubric toggles:",
    JSON.stringify(rubric, null, 2),
    "",
    "Changed files (bounded):",
    options.changedFiles.join("\n") || "(none)",
    "",
    "Dependency/import inspection context (best-effort):",
    JSON.stringify(options.dependencyInspection, null, 2),
    "",
    "Referenced TS/JS file snapshots from newly introduced relative imports (bounded):",
    options.referencedFileContext || "(none)",
    "",
    "Diff (may be truncated):",
    options.diff
  ].join("\n");
}

export interface PersonaRunRequest {
  name: string;
  repoPath: string;
  headRef: string;
  baseRef?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  outJsonPath?: string;
  outMarkdownPath?: string;
  stdout?: PersonaOutputStdout;
}

export interface PersonaRunPreflightResult {
  persona: PersonaDefinition;
  repoPath: string;
  baseResolution: {
    baseRef: string;
    resolvedFrom: "flag" | "main" | "origin-head";
  };
}

export interface PersonaReviewPromptInput {
  persona: PersonaDefinition;
  contextPack: PersonaContextPack;
  repoPath: string;
  headRef: string;
  baseRef: string;
  changedFiles: string[];
  diff: string;
  dependencyInspection: unknown;
  referencedSnapshots: ReferencedFileSnapshot[];
  activeStoryPath?: string;
}

export interface PersonaRuntimeRunResult {
  output: string;
  provider: string;
  model: string;
  createdAt: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  reliability?: unknown;
  contextMeta?: unknown;
}

export interface PersonaRuntimeRunner {
  run(request: {
    sessionId: string;
    input: string;
    provider?: string;
    model?: string;
    metadata: Record<string, string>;
    timeoutMs?: number;
  }): Promise<PersonaRuntimeRunResult>;
}

export interface PersonaModelExecutionInput {
  runtime: PersonaRuntimeRunner;
  sessionId: string;
  prompt: string;
  personaName: string;
  repoPath: string;
  provider?: string;
  model?: string;
}

export interface PersonaModelExecutionResult {
  runtimeResult?: PersonaRuntimeRunResult;
  modelOutputRaw: string;
  status: PersonaRunResult["status"];
  topError?: PersonaRunResult["error"];
  parseRetryAttempted: boolean;
  parsed: { parsed?: PersonaModelOutputV1; error?: string };
}

export interface PersonaOutputNormalizationInput {
  execution: PersonaModelExecutionResult;
  dependencyInspection: DependencyInspection;
  reviewScope?: "diff" | "implementation";
  activeStoryPath?: string;
  worktreeChangedFiles?: string[];
}

export interface PersonaOutputNormalizationResult {
  reportMarkdown: string;
  findings: PersonaModelOutputV1["findings"];
  mergeGate: "pass" | "fail";
  dependencyInspection: DependencyInspection;
  modelOutputRaw: string;
  modelOutputParsed: boolean;
  parseRetryAttempted: boolean;
  parseError?: string;
}

export interface PersistPersonaRunArtifactsInput {
  config: AthenaConfig;
  runId: string;
  personaResult: PersonaRunResult;
  reportMarkdown: string;
  outJsonPath?: string;
  outMarkdownPath?: string;
  persistFn?: typeof persistPersonaRunArtifacts;
}

export interface PersonaRunExecutionPreparation {
  contextPack: PersonaContextPack;
  diff: string;
  changedFiles: string[];
  dependencyInspection: DependencyInspection;
  activeStoryPath?: string;
  referenced: {
    meta: PersonaRunResult["referencedFileMeta"];
    snapshots: ReferencedFileSnapshot[];
  };
}

const PERSONA_REVIEW_DIFF_MAX_CHARS = 18_000;
const PERSONA_REVIEW_CHANGED_FILES_MAX = 300;

export interface BuildPersonaRunResultInput {
  request: PersonaRunRequest;
  runId: string;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  preflight: PersonaRunPreflightResult;
  executionPreparation: PersonaRunExecutionPreparation;
  execution: PersonaModelExecutionResult;
  normalization: PersonaOutputNormalizationResult;
  evidenceManifest: PersonaEvidenceManifestEntry[];
  config: AthenaConfig;
}

export interface PersonaRunOrchestratorDependencies {
  runPreflightChecks: typeof runPreflightChecks;
  assemblePersonaContextPack: typeof assemblePersonaContextPack;
  getDiff: typeof getDiff;
  listChangedFiles: typeof listChangedFiles;
  inspectDependenciesBestEffort: typeof inspectDependenciesBestEffort;
  collectReferencedFileSnapshots: typeof collectReferencedFileSnapshots;
  createRuntime: typeof createRuntime;
  constructPersonaReviewPrompt: typeof constructPersonaReviewPrompt;
  executeModelWithRepair: typeof executeModelWithRepair;
  normalizePersonaOutput: typeof normalizePersonaOutput;
  resolvePersonaRunPaths: typeof resolvePersonaRunPaths;
  resolveWorkspaceRelative: typeof resolveWorkspaceRelative;
  persistPersonaRunEvidenceBundle: typeof persistPersonaRunEvidenceBundle;
  persistPersonaRunResultArtifacts: typeof persistPersonaRunResultArtifacts;
  nowIso(): string;
  buildSafeId(prefix: string): string;
  lspService?: LspService;
}

interface PersonaEvidenceCollector {
  capture(attachment: RuntimeEvidenceAttachment): Promise<void>;
  flush(): Promise<PersonaEvidenceAttachment[]>;
}

function cloneRuntimeEvidenceAttachment(attachment: RuntimeEvidenceAttachment): RuntimeEvidenceAttachment {
  return {
    sessionId: attachment.sessionId,
    runId: attachment.runId,
    traceId: attachment.traceId,
    metadata: { ...attachment.metadata },
    label: attachment.label,
    type: attachment.type,
    content: attachment.content
  };
}

function createPersonaEvidenceCollector(nowIso: () => string): PersonaEvidenceCollector {
  const attachments: PersonaEvidenceAttachment[] = [];
  const pending = new Set<Promise<void>>();

  return {
    capture(attachment: RuntimeEvidenceAttachment): Promise<void> {
      const task = Promise.resolve().then(() => {
        const snapshot = cloneRuntimeEvidenceAttachment(attachment);
        attachments.push({
          sessionId: snapshot.sessionId,
          runtimeRunId: snapshot.runId,
          traceId: snapshot.traceId,
          label: snapshot.label,
          type: snapshot.type,
          content: snapshot.content,
          metadata: snapshot.metadata,
          capturedAt: nowIso()
        });
      });
      pending.add(task);
      void task.finally(() => pending.delete(task));
      return task;
    },
    async flush(): Promise<PersonaEvidenceAttachment[]> {
      await Promise.resolve();
      await Promise.allSettled(Array.from(pending));
      return attachments.map((attachment) => ({
        ...attachment,
        ...(attachment.metadata ? { metadata: { ...attachment.metadata } } : {})
      }));
    }
  };
}

function buildReferencedFileContext(snapshots: ReferencedFileSnapshot[]): string {
  return (
    snapshots
      .map((snapshot) =>
        [
          `---`,
          `from: ${snapshot.sourcePath}`,
          `import: ${snapshot.importSpecifier}`,
          `resolved: ${snapshot.path}`,
          `truncated: ${snapshot.truncated}`,
          snapshot.content
        ].join("\n")
      )
      .join("\n\n") || "(none)"
  );
}

async function detectActiveBacklogStoryPath(repoPath: string): Promise<string | undefined> {
  const backlogReadme = resolve(repoPath, "planning", "backlog", "active", "README.md");
  let raw: string;
  try {
    raw = await readFile(backlogReadme, "utf8");
  } catch {
    return undefined;
  }

  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/\[([^\]]+\.md)\]\(([^)]+\.md)\)/i);
    if (!match) {
      continue;
    }
    const linkedPath = match[2].trim();
    if (!linkedPath || linkedPath.toLowerCase().endsWith("readme.md")) {
      continue;
    }
    const relative = linkedPath.startsWith("planning/")
      ? linkedPath
      : `planning/backlog/active/${linkedPath.replace(/^\.\/+/, "")}`;
    return relative;
  }

  return undefined;
}

export function constructPersonaReviewPrompt(options: PersonaReviewPromptInput): string {
  const manifestSummary = JSON.stringify(
    {
      schemaVersion: options.contextPack.manifest.schemaVersion,
      personaId: options.contextPack.manifest.personaId,
      totals: options.contextPack.manifest.totals,
      limits: options.contextPack.manifest.limits
    },
    null,
    2
  );

  return buildReviewPrompt({
    personaContextSystem: options.contextPack.systemContent,
    personaContextUser: options.contextPack.userContent,
    contextManifestSummary: manifestSummary,
    availableTools: resolvePersonaToolset(options.persona),
    persona: options.persona,
    repoPath: options.repoPath,
    headRef: options.headRef,
    baseRef: options.baseRef,
    changedFiles: options.changedFiles,
    diff: options.diff,
    dependencyInspection: options.dependencyInspection,
    referencedFileContext: buildReferencedFileContext(options.referencedSnapshots),
    activeStoryPath: options.activeStoryPath
  });
}

export async function executeModelWithRepair(options: PersonaModelExecutionInput): Promise<PersonaModelExecutionResult> {
  let runtimeResult: PersonaRuntimeRunResult | undefined;
  let modelOutputRaw = "";
  let status: PersonaRunResult["status"] = "ok";
  let topError: PersonaRunResult["error"] | undefined;
  let parseRetryAttempted = false;

  try {
    runtimeResult = await options.runtime.run({
      sessionId: options.sessionId,
      input: options.prompt,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      metadata: {
        trigger: "persona:run",
        specialist: options.personaName,
        persona: options.personaName,
        repoPath: options.repoPath
      }
    });
    modelOutputRaw = runtimeResult.output;
  } catch (error) {
    status = "failed";
    modelOutputRaw = error instanceof Error ? error.message : String(error);
    topError = { message: modelOutputRaw };
  }

  let parsed = parsePersonaModelOutput(modelOutputRaw);
  if (status === "ok" && !parsed.parsed) {
    parseRetryAttempted = true;
    try {
      const repaired = await options.runtime.run({
        sessionId: options.sessionId,
        input: buildRepairPrompt(modelOutputRaw, parsed.error ?? "Invalid model output."),
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
        metadata: {
          trigger: "persona:repair-json",
          specialist: options.personaName,
          persona: options.personaName,
          repoPath: options.repoPath
        }
      });
      runtimeResult = repaired;
      modelOutputRaw = repaired.output;
      parsed = parsePersonaModelOutput(modelOutputRaw);
    } catch (error) {
      status = "failed";
      const message = `Repair retry failed: ${error instanceof Error ? error.message : String(error)}`;
      topError = { message };
      modelOutputRaw = message;
      parsed = { error: message };
    }
  }

  if (status === "ok" && !parsed.parsed) {
    status = "failed";
    topError = { message: `Failed to produce schema-valid code-review JSON output: ${parsed.error ?? "Unknown parse failure."}` };
  }

  return {
    ...(runtimeResult ? { runtimeResult } : {}),
    modelOutputRaw,
    status,
    ...(topError ? { topError } : {}),
    parseRetryAttempted,
    parsed
  };
}

function summarizeImplementationHistoryEntry(entry: {
  tool: string;
  input: Record<string, unknown>;
  result: { ok: boolean; output?: unknown; error?: string };
}): string {
  const compactInput = JSON.stringify(entry.input).slice(0, 400);
  const compactResult = entry.result.ok
    ? JSON.stringify(entry.result.output ?? "").slice(0, 800)
    : String(entry.result.error ?? "unknown tool error").slice(0, 800);
  return [`tool=${entry.tool}`, `input=${compactInput}`, `result=${compactResult}`].join("\n");
}

function buildImplementationLoopPrompt(options: {
  basePrompt: string;
  turn: number;
  maxTurns: number;
  phase: "discovery" | "implementation" | "finalization";
  allowToolSteps: boolean;
  history: Array<{ tool: string; input: Record<string, unknown>; result: { ok: boolean; output?: unknown; error?: string } }>;
}): string {
  const historyWindow = options.history.slice(-16);
  const historySection =
    historyWindow.length === 0
      ? "(none)"
      : historyWindow.map((entry, index) => [`Step ${index + 1}:`, summarizeImplementationHistoryEntry(entry)].join("\n")).join("\n\n");

  const phaseInstruction =
    options.phase === "discovery"
      ? "- Phase: discovery. Focus on reading story/contracts and inspecting relevant files."
      : options.phase === "implementation"
        ? "- Phase: implementation. Focus on edits, commands, and validation."
        : "- Phase: finalization. Tool calls are disabled; return a final JSON report now.";

  const actionInstruction = options.allowToolSteps
    ? "- You may return either a tool step or final step."
    : "- You MUST return action='final'. Do not return action='tool'.";

  return [
    options.basePrompt,
    "",
    "IMPLEMENTATION EXECUTION MODE:",
    `- Turn ${options.turn} of ${options.maxTurns}.`,
    phaseInstruction,
    actionInstruction,
    "- Return ONLY strict JSON with one of:",
    "  1) Tool step: {\"schemaVersion\":1,\"action\":\"tool\",\"tool\":\"read_file|list_dir|run_exec|memory_search|memory_get\",\"input\":{...}}",
    "  2) Final step: {\"schemaVersion\":1,\"action\":\"final\", ... PersonaModelOutputV1 fields ...}",
    "- Avoid repeating the same tool call with identical input unless new evidence changed.",
    "",
    "Recent tool execution history (windowed):",
    historySection
  ].join("\n");
}

export async function executeImplementationLoop(options: PersonaModelExecutionInput & { config: AthenaConfig }): Promise<PersonaModelExecutionResult> {
  const maxTurns = 72;
  const discoveryTurns = 10;
  const finalOnlyTurns = 8;
  const turnTimeoutMs = Math.max(180_000, options.config.runtimeRunTimeoutMs);
  const history: Array<{ tool: string; input: Record<string, unknown>; result: { ok: boolean; output?: unknown; error?: string } }> = [];
  const toolCallCounts = new Map<string, number>();
  let lastToolSignature = "";
  let consecutiveSameToolCalls = 0;
  let toolCalls = 0;
  let runtimeResult: PersonaRuntimeRunResult | undefined;
  let modelOutputRaw = "";
  let parseRetryAttempted = false;

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const phase: "discovery" | "implementation" | "finalization" =
      turn <= discoveryTurns ? "discovery" : turn > maxTurns - finalOnlyTurns ? "finalization" : "implementation";
    const allowToolSteps = phase !== "finalization";
    try {
      runtimeResult = await options.runtime.run({
        sessionId: options.sessionId,
        input: buildImplementationLoopPrompt({
          basePrompt: options.prompt,
          turn,
          maxTurns,
          phase,
          allowToolSteps,
          history
        }),
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
        metadata: {
          trigger: "persona:implementation-loop",
          specialist: options.personaName,
          persona: options.personaName,
          repoPath: options.repoPath,
          turn: String(turn)
        },
        timeoutMs: turnTimeoutMs
      });
      modelOutputRaw = runtimeResult.output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ...(runtimeResult ? { runtimeResult } : {}),
        modelOutputRaw: message,
        status: "failed",
        topError: { message },
        parseRetryAttempted,
        parsed: { error: message }
      };
    }

    let parsedStep = parseImplementationStep(modelOutputRaw);
    if (!parsedStep.step) {
      parseRetryAttempted = true;
      try {
        const repaired = await options.runtime.run({
          sessionId: options.sessionId,
          input: buildImplementationStepRepairPrompt(modelOutputRaw, parsedStep.error ?? "Invalid implementation step output."),
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.model ? { model: options.model } : {}),
          metadata: {
            trigger: "persona:implementation-repair",
            specialist: options.personaName,
            persona: options.personaName,
            repoPath: options.repoPath,
            turn: String(turn)
          },
          timeoutMs: turnTimeoutMs
        });
        runtimeResult = repaired;
        modelOutputRaw = repaired.output;
        parsedStep = parseImplementationStep(modelOutputRaw);
      } catch (error) {
        const message = `Implementation repair retry failed: ${error instanceof Error ? error.message : String(error)}`;
        return {
          ...(runtimeResult ? { runtimeResult } : {}),
          modelOutputRaw: message,
          status: "failed",
          topError: { message },
          parseRetryAttempted,
          parsed: { error: message }
        };
      }
    }

    if (!parsedStep.step) {
      const message = `Failed to produce valid implementation-step JSON: ${parsedStep.error ?? "Unknown parse failure."}`;
      return {
        ...(runtimeResult ? { runtimeResult } : {}),
        modelOutputRaw: message,
        status: "failed",
        topError: { message },
        parseRetryAttempted,
        parsed: { error: message }
      };
    }

    if (parsedStep.step.action === "final") {
      return {
        ...(runtimeResult ? { runtimeResult } : {}),
        modelOutputRaw,
        status: "ok",
        parseRetryAttempted,
        parsed: { parsed: parsedStep.step }
      };
    }

    if (!allowToolSteps) {
      history.push({
        tool: "loop-guard",
        input: {},
        result: { ok: false, error: "Tool calls disabled during finalization phase. Return action='final'." }
      });
      continue;
    }

    const toolInput = parsedStep.step.input ?? {};
    const toolSignature = `${parsedStep.step.tool}:${JSON.stringify(toolInput)}`;
    const seenCount = (toolCallCounts.get(toolSignature) ?? 0) + 1;
    toolCallCounts.set(toolSignature, seenCount);
    consecutiveSameToolCalls = toolSignature === lastToolSignature ? consecutiveSameToolCalls + 1 : 1;
    lastToolSignature = toolSignature;

    if (consecutiveSameToolCalls >= 3 || seenCount >= 5) {
      history.push({
        tool: parsedStep.step.tool,
        input: toolInput,
        result: {
          ok: false,
          error:
            "Loop watchdog blocked repeated identical tool calls. Choose a different tool/input or finalize with action='final'."
        }
      });
      continue;
    }

    toolCalls += 1;
    if (toolCalls > 180) {
      const message = `Implementation loop exceeded tool-call budget (${toolCalls}).`;
      return {
        ...(runtimeResult ? { runtimeResult } : {}),
        modelOutputRaw: message,
        status: "failed",
        topError: { message },
        parseRetryAttempted,
        parsed: { error: message }
      };
    }

    const toolResult = await executeImplementationTool({
      step: parsedStep.step,
      repoPath: options.repoPath,
      config: options.config
    });
    history.push({
      tool: parsedStep.step.tool,
      input: toolInput,
      result: toolResult.ok ? { ok: true, output: toolResult.output } : { ok: false, error: toolResult.error }
    });
  }

  const timeoutMessage = `Implementation loop reached max turns (${maxTurns}) without final output.`;
  return {
    ...(runtimeResult ? { runtimeResult } : {}),
    modelOutputRaw: timeoutMessage,
    status: "failed",
    topError: { message: timeoutMessage },
    parseRetryAttempted,
    parsed: { error: timeoutMessage }
  };
}

export function normalizePersonaOutput(options: PersonaOutputNormalizationInput): PersonaOutputNormalizationResult {
  const { execution, dependencyInspection } = options;
  let reportMarkdown = execution.parsed.parsed?.reportMarkdown ?? execution.modelOutputRaw;
  let findings = execution.parsed.parsed?.findings ?? [];
  let mergeGate: "pass" | "fail" =
    execution.parsed.parsed?.mergeGate ?? (findings.some((finding) => finding.priority === "P1") ? "fail" : "pass");

  const reportNormalized = reportMarkdown.trim().toLowerCase();
  const falseNoTask =
    options.reviewScope === "implementation" &&
    typeof options.activeStoryPath === "string" &&
    options.activeStoryPath.length > 0 &&
    reportNormalized === "no tasks available";
  if (falseNoTask) {
    findings = [
      ...findings,
      {
        priority: "P1",
        confidence: 1,
        title: "False empty queue result",
        message: `Runtime preflight detected an actionable backlog story (${options.activeStoryPath}), but the model returned 'no tasks available'.`,
        suggestion: `Load and execute ${options.activeStoryPath} and complete required tests and handoff tasks.`,
        file: options.activeStoryPath,
        line: 1
      }
    ];
    mergeGate = "fail";
    reportMarkdown = [
      "# Story Execution Status: BLOCKED",
      "",
      `Actionable story detected by runtime: \`${options.activeStoryPath}\`.`,
      "Model output incorrectly reported `no tasks available`.",
      "",
      "Next action: execute the active story and report implementation + validation results."
    ].join("\n");
  }

  const missingWorktreeChanges =
    options.reviewScope === "implementation" &&
    typeof options.activeStoryPath === "string" &&
    options.activeStoryPath.length > 0 &&
    (options.worktreeChangedFiles?.length ?? 0) === 0;
  if (missingWorktreeChanges) {
    findings = [
      ...findings,
      {
        priority: "P1",
        confidence: 1,
        title: "No implementation changes detected",
        message: `Implementation mode requires concrete repository changes for active story ${options.activeStoryPath}, but the worktree remained unchanged after execution.`,
        suggestion: `Execute ${options.activeStoryPath} and apply code/test/handoff file updates in this run.`,
        file: options.activeStoryPath,
        line: 1
      }
    ];
    mergeGate = "fail";
    if (reportNormalized === "no tasks available") {
      reportMarkdown = [
        "# Story Execution Status: BLOCKED",
        "",
        `Active story detected: \`${options.activeStoryPath}\`.`,
        "No repository changes were applied during implementation mode.",
        "",
        "Next action: apply code + tests + handoff updates for the active story in this run."
      ].join("\n");
    }
  }

  // Let the model override dependencyInspection status/notes, but keep computed signals for context.
  const mergedDependencyInspection: DependencyInspection = {
    ...dependencyInspection,
    ...(execution.parsed.parsed?.dependencyInspection?.status ? { status: execution.parsed.parsed.dependencyInspection.status } : {}),
    ...(execution.parsed.parsed?.dependencyInspection?.notes ? { notes: execution.parsed.parsed.dependencyInspection.notes } : {})
  };

  return {
    reportMarkdown,
    findings,
    mergeGate,
    dependencyInspection: mergedDependencyInspection,
    modelOutputRaw: execution.modelOutputRaw,
    modelOutputParsed: Boolean(execution.parsed.parsed),
    parseRetryAttempted: execution.parseRetryAttempted,
    ...(execution.parsed.error ? { parseError: execution.parsed.error } : {})
  };
}

export async function persistPersonaRunResultArtifacts(options: PersistPersonaRunArtifactsInput): Promise<void> {
  const persist = options.persistFn ?? persistPersonaRunArtifacts;
  await persist({
    config: options.config,
    runId: options.runId,
    jsonPayload: `${JSON.stringify(options.personaResult, null, 2)}\n`,
    markdownPayload: `${options.reportMarkdown.trimEnd()}\n`,
    ...(options.outJsonPath ? { outJsonPath: options.outJsonPath } : {}),
    ...(options.outMarkdownPath ? { outMarkdownPath: options.outMarkdownPath } : {})
  });
}

export async function runPreflightChecks(
  request: PersonaRunRequest,
  workspaceRoot: string,
  options: {
    stateDir?: string;
  } = {}
): Promise<PersonaRunPreflightResult> {
  const persona = await loadPersonaDefinition(workspaceRoot, request.name);
  const repoPath = resolve(workspaceRoot, request.repoPath);

  await assertGitRepo(repoPath);
  if (persona.git?.requireCleanWorktree ?? true) {
    await assertCleanWorktree(repoPath, {
      excludePaths: options.stateDir ? [options.stateDir] : []
    });
  }

  const baseResolution = await resolveBaseRef({
    repoPath,
    defaultBaseRef: persona.git?.baseRefDefault ?? "main",
    allowAutodetect: persona.git?.baseRefAutodetect ?? true,
    ...(request.baseRef ? { baseRefFlag: request.baseRef } : {})
  });

  await assertRefExists(repoPath, baseResolution.baseRef);
  await assertRefExists(repoPath, request.headRef);

  return {
    persona,
    repoPath,
    baseResolution
  };
}

const DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES: PersonaRunOrchestratorDependencies = {
  runPreflightChecks,
  assemblePersonaContextPack,
  getDiff,
  listChangedFiles,
  inspectDependenciesBestEffort,
  collectReferencedFileSnapshots,
  createRuntime,
  constructPersonaReviewPrompt,
  executeModelWithRepair,
  normalizePersonaOutput,
  resolvePersonaRunPaths,
  resolveWorkspaceRelative,
  persistPersonaRunEvidenceBundle,
  persistPersonaRunResultArtifacts,
  nowIso: () => new Date().toISOString(),
  buildSafeId: safeId
};

export async function preparePersonaRunExecution(
  request: PersonaRunRequest,
  config: AthenaConfig,
  preflight: PersonaRunPreflightResult,
  dependencies: PersonaRunOrchestratorDependencies
): Promise<PersonaRunExecutionPreparation> {
  const { persona, repoPath, baseResolution } = preflight;
  const contextPack = await dependencies.assemblePersonaContextPack({
    workspaceRoot: config.workspaceRoot,
    persona
  });
  const diff = await dependencies.getDiff(repoPath, baseResolution.baseRef, request.headRef, PERSONA_REVIEW_DIFF_MAX_CHARS);
  const changedFiles = await dependencies.listChangedFiles(
    repoPath,
    baseResolution.baseRef,
    request.headRef,
    PERSONA_REVIEW_CHANGED_FILES_MAX
  );
  const dependencyInspection = await dependencies.inspectDependenciesBestEffort({
    repoPath,
    headRef: request.headRef,
    changedFiles,
    diff
  });
  const referenced = await dependencies.collectReferencedFileSnapshots({
    repoPath,
    headRef: request.headRef,
    diff,
    ...(config.context?.strategy ? { contextStrategy: config.context.strategy } : {}),
    ...(dependencies.lspService ? { lspService: dependencies.lspService } : {}),
    ...(persona.review?.maxReferencedFiles !== undefined ? { maxReferencedFiles: persona.review.maxReferencedFiles } : {}),
    ...(persona.review?.maxReferencedFileChars !== undefined
      ? { maxReferencedFileChars: persona.review.maxReferencedFileChars }
      : {})
  });
  const activeStoryPath =
    persona.review?.scope === "implementation" ? await detectActiveBacklogStoryPath(repoPath) : undefined;

  return {
    contextPack,
    diff,
    changedFiles,
    dependencyInspection,
    ...(activeStoryPath ? { activeStoryPath } : {}),
    referenced
  };
}

export function buildPersonaRunResult(options: BuildPersonaRunResultInput): PersonaRunResult {
  const { request, preflight, executionPreparation, execution, normalization, config } = options;
  const { runtimeResult, topError } = execution;
  const { repoPath, baseResolution } = preflight;
  const { contextPack, referenced } = executionPreparation;
  const { reportMarkdown, findings, mergeGate, dependencyInspection, modelOutputRaw, modelOutputParsed, parseRetryAttempted, parseError } =
    normalization;

  const auditPaths = resolvePersonaRunPaths(config, options.runId);
  const outJsonAbs = request.outJsonPath ? resolveWorkspaceRelative(config.workspaceRoot, request.outJsonPath) : undefined;
  const outMdAbs = request.outMarkdownPath ? resolveWorkspaceRelative(config.workspaceRoot, request.outMarkdownPath) : undefined;

  return {
    schemaVersion: PERSONA_RUN_SCHEMA_VERSION,
    runId: options.runId,
    personaName: request.name,
    specialistName: request.name,
    sessionId: options.sessionId,
    repoPath,
    headRef: request.headRef,
    baseRef: baseResolution.baseRef,
    baseRefResolvedFrom: baseResolution.resolvedFrom,
    status: execution.status,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    artifacts: {
      auditDir: auditPaths.auditDir,
      resultJsonPath: auditPaths.resultJsonPath,
      reportMarkdownPath: auditPaths.reportMarkdownPath,
      ...(outJsonAbs ? { outJsonPath: outJsonAbs } : {}),
      ...(outMdAbs ? { outMarkdownPath: outMdAbs } : {})
    },
    contextManifest: contextPack.manifest,
    referencedFileMeta: referenced.meta,
    referencedFileSnapshots: referenced.snapshots,
    evidenceManifest: options.evidenceManifest.map((entry) => ({ ...entry })),
    dependencyInspection,
    findings,
    mergeGate,
    ...(runtimeResult?.usage ? { usage: runtimeResult.usage } : {}),
    ...(runtimeResult?.contextMeta ? { contextMeta: runtimeResult.contextMeta } : {}),
    reportMarkdown,
    modelOutputRaw,
    modelOutputParsed,
    parseRetryAttempted,
    ...(parseError ? { parseError } : {}),
    ...(runtimeResult
      ? {
          runtimeResult: {
            provider: runtimeResult.provider,
            model: runtimeResult.model,
            createdAt: runtimeResult.createdAt,
            ...(runtimeResult.usage ? { usage: runtimeResult.usage } : {}),
            ...(runtimeResult.reliability ? { reliability: runtimeResult.reliability } : {}),
            ...(runtimeResult.contextMeta ? { contextMeta: runtimeResult.contextMeta } : {})
          }
        }
      : {}),
    ...(topError ? { error: topError } : {}),
  };
}

export function renderPersonaRunStdout(
  request: PersonaRunRequest,
  personaResult: PersonaRunResult,
  persona: PersonaDefinition
): string {
  const stdoutMode = request.stdout ?? persona.output?.stdoutDefault ?? "summary";
  if (stdoutMode === "none") {
    return "";
  }
  if (stdoutMode === "json") {
    return JSON.stringify(personaResult, null, 2);
  }
  if (stdoutMode === "md") {
    return personaResult.reportMarkdown;
  }

  const summaryLines = [
    `specialist: ${request.name}`,
    `runId: ${personaResult.runId}`,
    `status: ${personaResult.status}`,
    `compare: ${personaResult.baseRef}..${personaResult.headRef}`,
    `evidence: ${personaResult.evidenceManifest.length}`,
    `result.json: ${personaResult.artifacts.resultJsonPath}`,
    `report.md: ${personaResult.artifacts.reportMarkdownPath}`,
    ...(personaResult.parseError ? [`parseError: ${personaResult.parseError}`] : [])
  ];
  return summaryLines.join("\n");
}

export async function runPersonaOrchestrator(
  request: PersonaRunRequest,
  config: AthenaConfig,
  dependencies: PersonaRunOrchestratorDependencies = DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES
): Promise<{ result: PersonaRunResult; stdout: string }> {
  const preflight = await dependencies.runPreflightChecks(request, config.workspaceRoot, {
    stateDir: config.stateDir
  });
  const executionPreparation = await preparePersonaRunExecution(request, config, preflight, dependencies);
  const startedAt = dependencies.nowIso();
  const runId = dependencies.buildSafeId(`persona-${request.name}`);
  const sessionId = request.sessionId ?? dependencies.buildSafeId(`session-${request.name}`);
  const evidenceCollector = createPersonaEvidenceCollector(dependencies.nowIso);

  const prompt = dependencies.constructPersonaReviewPrompt({
    persona: preflight.persona,
    contextPack: executionPreparation.contextPack,
    repoPath: preflight.repoPath,
    headRef: request.headRef,
    baseRef: preflight.baseResolution.baseRef,
    changedFiles: executionPreparation.changedFiles,
    diff: executionPreparation.diff,
    dependencyInspection: executionPreparation.dependencyInspection,
    referencedSnapshots: executionPreparation.referenced.snapshots,
    ...(executionPreparation.activeStoryPath ? { activeStoryPath: executionPreparation.activeStoryPath } : {})
  });
  const runtime = dependencies.createRuntime({ config });
  const runtimeWithEvidenceCapture: PersonaRuntimeRunner = {
    run: (runRequest) =>
      runtime.run(runRequest, {
        ...(typeof runRequest.timeoutMs === "number" ? { timeoutMs: runRequest.timeoutMs } : {}),
        onAttachEvidence: async (attachment) => {
          await evidenceCollector.capture(attachment);
        }
      })
  };
  const execution =
    preflight.persona.review?.scope === "implementation"
      ? await executeImplementationLoop({
          runtime: runtimeWithEvidenceCapture,
          sessionId,
          prompt,
          personaName: request.name,
          repoPath: preflight.repoPath,
          config,
          ...(request.provider ? { provider: request.provider } : {}),
          ...(request.model ? { model: request.model } : {})
        })
      : await dependencies.executeModelWithRepair({
          runtime: runtimeWithEvidenceCapture,
          sessionId,
          prompt,
          personaName: request.name,
          repoPath: preflight.repoPath,
          ...(request.provider ? { provider: request.provider } : {}),
          ...(request.model ? { model: request.model } : {})
        });
  const worktreeChangedFiles =
    preflight.persona.review?.scope === "implementation" ? await listWorktreeChangedFiles(preflight.repoPath) : [];
  const normalization = dependencies.normalizePersonaOutput({
    execution,
    dependencyInspection: executionPreparation.dependencyInspection,
    reviewScope: preflight.persona.review?.scope,
    ...(worktreeChangedFiles.length > 0 ? { worktreeChangedFiles } : {}),
    ...(executionPreparation.activeStoryPath ? { activeStoryPath: executionPreparation.activeStoryPath } : {})
  });
  const capturedEvidence = await evidenceCollector.flush();
  const evidenceManifest = await dependencies.persistPersonaRunEvidenceBundle({
    config,
    runId,
    attachments: capturedEvidence
  });
  const finishedAt = dependencies.nowIso();
  const result = buildPersonaRunResult({
    request,
    runId,
    sessionId,
    startedAt,
    finishedAt,
    preflight,
    executionPreparation,
    execution,
    normalization,
    evidenceManifest,
    config
  });

  await dependencies.persistPersonaRunResultArtifacts({
    config,
    runId,
    personaResult: result,
    reportMarkdown: normalization.reportMarkdown,
    ...(request.outJsonPath ? { outJsonPath: request.outJsonPath } : {}),
    ...(request.outMarkdownPath ? { outMarkdownPath: request.outMarkdownPath } : {})
  });

  return {
    result,
    stdout: renderPersonaRunStdout(request, result, preflight.persona)
  };
}

export async function runPersona(
  request: PersonaRunRequest,
  config: AthenaConfig,
  options: { lspService?: LspService } = {}
): Promise<{ result: PersonaRunResult; stdout: string }> {
  if (!options.lspService) {
    return runPersonaOrchestrator(request, config);
  }
  return runPersonaOrchestrator(request, config, {
    ...DEFAULT_PERSONA_RUN_ORCHESTRATOR_DEPENDENCIES,
    lspService: options.lspService
  });
}

export type SpecialistRunRequest = PersonaRunRequest;
export type SpecialistRunPreflightResult = PersonaRunPreflightResult;
export type SpecialistReviewPromptInput = PersonaReviewPromptInput;
export type SpecialistRuntimeRunResult = PersonaRuntimeRunResult;
export type SpecialistRuntimeRunner = PersonaRuntimeRunner;
export type SpecialistModelExecutionInput = PersonaModelExecutionInput;
export type SpecialistModelExecutionResult = PersonaModelExecutionResult;
export type BuildSpecialistRunResultInput = BuildPersonaRunResultInput;
export type SpecialistRunOrchestratorDependencies = PersonaRunOrchestratorDependencies;
export type SpecialistRunExecutionPreparation = PersonaRunExecutionPreparation;
export type PersistSpecialistRunArtifactsInput = PersistPersonaRunArtifactsInput;

export const persistSpecialistRunResultArtifacts = persistPersonaRunResultArtifacts;
export const runSpecialistOrchestrator = runPersonaOrchestrator;
export const runSpecialist = runPersona;
export const constructSpecialistReviewPrompt = constructPersonaReviewPrompt;
export const renderSpecialistRunStdout = renderPersonaRunStdout;
