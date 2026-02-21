import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ScheduleManager, assertValidScheduleId } from "../schedule/index.js";
import { acquireSessionLock } from "../runtime/session-lock.js";
import { assertValidSessionId, resolveRuntimePaths, SessionStore, type RuntimePaths } from "../runtime/session-store.js";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import type {
  Directive,
  DirectiveCreateRequest,
  HarnessProfile,
  HarnessProfileCreateRequest,
  RunTemplate,
  RunTemplateCreateRequest,
  Workflow,
  WorkflowCreateRequest,
  WorkflowRun,
  WorkflowRunStepState,
  ScheduleRunLog,
  ScheduledTask,
  SessionRecord,
  TranscriptEntry,
  WorkQueueState
} from "../shared/contracts.js";
import { WorkManager } from "../work/index.js";
import { allocateUniqueId, atomicWriteFile } from "./state-store/io-utils.js";
import {
  cloneWorkflowStepStates,
  normalizeDirective,
  normalizeHarnessProfile,
  normalizeRunEvidenceContent,
  normalizeRunEvidenceRecord,
  normalizeRunTemplate,
  normalizeWorkflow,
  normalizeWorkflowRun
} from "./state-store/normalizers.js";
import { resolveJsonPathWithinRoot, resolvePathWithinRoot } from "./state-store/path-utils.js";
import type { RunEvidenceRecord, RunEvidenceType, StateStore } from "./state-store/types.js";

const SESSION_SCHEMA_VERSION = 1;
const RUN_EVIDENCE_SCHEMA_VERSION = 1;

export type { RunEvidenceRecord, RunEvidenceType, StateStore } from "./state-store/types.js";

export class FileStateStore implements StateStore {
  readonly kind = "file" as const;
  private lastIssuedTimestampMs = 0;
  private readonly paths: RuntimePaths;
  private readonly sessionStore: SessionStore;
  private readonly workManager: WorkManager;
  private readonly scheduleManager: ScheduleManager;
  private readonly directivesDir: string;
  private readonly directivesLockPath: string;
  private readonly harnessProfilesDir: string;
  private readonly harnessProfilesLockPath: string;
  private readonly runTemplatesDir: string;
  private readonly runTemplatesLockPath: string;
  private readonly workflowsDir: string;
  private readonly workflowsLockPath: string;
  private readonly workflowRunsDir: string;
  private readonly workflowRunsLockPath: string;
  private readonly runEvidenceDir: string;
  private readonly runEvidenceLockPath: string;

  constructor(private readonly config: AthenaConfig) {
    this.paths = resolveRuntimePaths(config);
    this.sessionStore = new SessionStore(config);
    this.workManager = new WorkManager(config);
    this.scheduleManager = new ScheduleManager(config);
    this.directivesDir = resolve(this.paths.stateRoot, "directives");
    this.directivesLockPath = resolve(this.directivesDir, "directives.lock");
    this.harnessProfilesDir = resolve(this.paths.stateRoot, "harness-profiles");
    this.harnessProfilesLockPath = resolve(this.harnessProfilesDir, "harness-profiles.lock");
    this.runTemplatesDir = resolve(this.paths.stateRoot, "run-templates");
    this.runTemplatesLockPath = resolve(this.runTemplatesDir, "run-templates.lock");
    this.workflowsDir = resolve(this.paths.stateRoot, "workflows");
    this.workflowsLockPath = resolve(this.workflowsDir, "workflows.lock");
    this.workflowRunsDir = resolve(this.paths.stateRoot, "workflow-runs");
    this.workflowRunsLockPath = resolve(this.workflowRunsDir, "workflow-runs.lock");
    this.runEvidenceDir = resolve(this.paths.stateRoot, "run-evidence");
    this.runEvidenceLockPath = resolve(this.runEvidenceDir, "run-evidence.lock");
  }

  async listSessions(): Promise<SessionRecord[]> {
    await this.sessionStore.ensureStateDirectories();
    const fileNames = await readdir(this.paths.sessionsDir);
    const sessions: SessionRecord[] = [];

    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const sessionPath = resolve(this.paths.sessionsDir, fileName);
      if (!existsSync(sessionPath)) {
        continue;
      }
      const raw = await readFile(sessionPath, "utf8");
      const parsed = JSON.parse(raw) as SessionRecord;
      sessions.push({
        ...parsed,
        schemaVersion: SESSION_SCHEMA_VERSION
      });
    }

    sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return sessions;
  }

  async getSession(sessionId: string): Promise<SessionRecord | undefined> {
    assertValidSessionId(sessionId);
    const sessions = await this.listSessions();
    return sessions.find((session) => session.id === sessionId);
  }

  async getTranscript(sessionId: string, options: { limit?: number; after?: string } = {}): Promise<TranscriptEntry[]> {
    assertValidSessionId(sessionId);
    await this.sessionStore.ensureStateDirectories();
    const transcriptPath = this.sessionStore.resolveTranscriptPath(sessionId);
    if (!existsSync(transcriptPath)) {
      return [];
    }

    const raw = await readFile(transcriptPath, "utf8");
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TranscriptEntry);

    const offset = options.after ? entries.findIndex((entry) => entry.id === options.after) : -1;
    const remaining = offset >= 0 ? entries.slice(offset + 1) : entries;
    const limit = options.limit ?? remaining.length;
    if (!Number.isFinite(limit) || limit <= 0 || limit >= remaining.length) {
      return remaining;
    }
    if (options.after) {
      return remaining.slice(0, Math.floor(limit));
    }
    return remaining.slice(-Math.floor(limit));
  }

  async getWorkQueue(sessionId: string): Promise<WorkQueueState> {
    assertValidSessionId(sessionId);
    return this.workManager.loadQueue(sessionId);
  }

  async listDirectives(): Promise<Directive[]> {
    await this.ensureDirectivesDirectory();
    const fileNames = await readdir(this.directivesDir);
    const directives: Directive[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const directivePath = this.resolveDirectivePath(fileName.slice(0, -".json".length));
      if (!existsSync(directivePath)) {
        continue;
      }
      const raw = await readFile(directivePath, "utf8");
      directives.push(normalizeDirective(JSON.parse(raw) as unknown, directivePath));
    }
    directives.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return directives;
  }

  async createDirective(request: DirectiveCreateRequest): Promise<Directive> {
    await this.ensureDirectivesDirectory();
    const lock = await acquireSessionLock(this.directivesLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const id = await this.allocateDirectiveId();
      const directivePath = this.resolveDirectivePath(id);
      const createdAt = this.issueMonotonicIsoTimestamp();
      const directive: Directive = {
        id,
        input: request.input,
        ...(request.contextRefs ? { contextRefs: request.contextRefs } : {}),
        ...(request.metadata ? { metadata: request.metadata } : {}),
        createdAt
      };
      await atomicWriteFile(directivePath, `${JSON.stringify(directive, null, 2)}\n`);
      return directive;
    } finally {
      await lock.release();
    }
  }

  async listHarnessProfiles(): Promise<HarnessProfile[]> {
    await this.ensureHarnessProfilesDirectory();
    const fileNames = await readdir(this.harnessProfilesDir);
    const profiles: HarnessProfile[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const profilePath = this.resolveHarnessProfilePath(fileName.slice(0, -".json".length));
      if (!existsSync(profilePath)) {
        continue;
      }
      const raw = await readFile(profilePath, "utf8");
      profiles.push(normalizeHarnessProfile(JSON.parse(raw) as unknown, profilePath));
    }
    profiles.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return profiles;
  }

  async createHarnessProfile(request: HarnessProfileCreateRequest): Promise<HarnessProfile> {
    await this.ensureHarnessProfilesDirectory();
    const lock = await acquireSessionLock(this.harnessProfilesLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const id = await this.allocateHarnessProfileId();
      const profilePath = this.resolveHarnessProfilePath(id);
      const createdAt = this.issueMonotonicIsoTimestamp();
      const profile: HarnessProfile = {
        id,
        displayName: request.displayName,
        version: request.version,
        config: {
          provider: request.config.provider,
          model: request.config.model,
          tools: [...request.config.tools]
        },
        policies: {
          timeoutMs: request.policies.timeoutMs,
          retryLimit: request.policies.retryLimit,
          budgetUsd: request.policies.budgetUsd
        },
        ...(request.allowedEgress
          ? {
              allowedEgress: request.allowedEgress.map((rule) => ({
                host: rule.host,
                ...(rule.port !== undefined ? { port: rule.port } : {})
              }))
            }
          : {}),
        ...(request.verificationPolicies
          ? {
              verificationPolicies: request.verificationPolicies.map((policy) => ({ ...policy }))
            }
          : {}),
        createdAt
      };
      await atomicWriteFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
      return profile;
    } finally {
      await lock.release();
    }
  }

  async listRunTemplates(): Promise<RunTemplate[]> {
    await this.ensureRunTemplatesDirectory();
    const fileNames = await readdir(this.runTemplatesDir);
    const templates: RunTemplate[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const templatePath = this.resolveRunTemplatePath(fileName.slice(0, -".json".length));
      if (!existsSync(templatePath)) {
        continue;
      }
      const raw = await readFile(templatePath, "utf8");
      templates.push(normalizeRunTemplate(JSON.parse(raw) as unknown, templatePath));
    }
    templates.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return templates;
  }

  async createRunTemplate(request: RunTemplateCreateRequest): Promise<RunTemplate> {
    await this.ensureRunTemplatesDirectory();
    const lock = await acquireSessionLock(this.runTemplatesLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const id = await this.allocateRunTemplateId();
      const templatePath = this.resolveRunTemplatePath(id);
      const createdAt = this.issueMonotonicIsoTimestamp();
      const template: RunTemplate = {
        id,
        harnessProfileId: request.harnessProfileId,
        directiveTemplate: request.directiveTemplate,
        defaultParams: { ...request.defaultParams },
        createdAt
      };
      await atomicWriteFile(templatePath, `${JSON.stringify(template, null, 2)}\n`);
      return template;
    } finally {
      await lock.release();
    }
  }

  async listWorkflows(): Promise<Workflow[]> {
    await this.ensureWorkflowsDirectory();
    const fileNames = await readdir(this.workflowsDir);
    const workflows: Workflow[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const workflowPath = this.resolveWorkflowPath(fileName.slice(0, -".json".length));
      if (!existsSync(workflowPath)) {
        continue;
      }
      const raw = await readFile(workflowPath, "utf8");
      workflows.push(normalizeWorkflow(JSON.parse(raw) as unknown, workflowPath));
    }
    workflows.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return workflows;
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    await this.ensureWorkflowsDirectory();
    const workflowPath = this.resolveWorkflowPath(id);
    if (!existsSync(workflowPath)) {
      return undefined;
    }
    const raw = await readFile(workflowPath, "utf8");
    return normalizeWorkflow(JSON.parse(raw) as unknown, workflowPath);
  }

  async createWorkflow(request: WorkflowCreateRequest): Promise<Workflow> {
    await this.ensureWorkflowsDirectory();
    const lock = await acquireSessionLock(this.workflowsLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const id = await this.allocateWorkflowId();
      const workflowPath = this.resolveWorkflowPath(id);
      const createdAt = this.issueMonotonicIsoTimestamp();
      const workflow: Workflow = {
        id,
        definition: request.definition,
        createdAt
      };
      await atomicWriteFile(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
      return workflow;
    } finally {
      await lock.release();
    }
  }

  async listWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    const workflowRunDir = await this.ensureWorkflowRunDirectory(workflowId);
    const fileNames = await readdir(workflowRunDir);
    const runs: WorkflowRun[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const runPath = this.resolveWorkflowRunPath(workflowId, fileName.slice(0, -".json".length));
      if (!existsSync(runPath)) {
        continue;
      }
      const raw = await readFile(runPath, "utf8");
      runs.push(normalizeWorkflowRun(JSON.parse(raw) as unknown, runPath, workflowId));
    }
    runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return runs;
  }

  async createWorkflowRun(request: {
    workflowId: string;
    stepOrder: string[];
    stepStates: Record<string, WorkflowRunStepState>;
    resumedFromRunId?: string;
  }): Promise<WorkflowRun> {
    await this.ensureWorkflowRunDirectory(request.workflowId);
    const lock = await acquireSessionLock(this.workflowRunsLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const runId = await this.allocateWorkflowRunId(request.workflowId);
      const runPath = this.resolveWorkflowRunPath(request.workflowId, runId);
      const now = this.issueMonotonicIsoTimestamp();
      const run: WorkflowRun = {
        schemaVersion: 1,
        id: runId,
        workflowId: request.workflowId,
        status: "pending",
        stepOrder: [...request.stepOrder],
        stepStates: cloneWorkflowStepStates(request.stepStates),
        executionLog: [],
        ...(request.resumedFromRunId ? { resumedFromRunId: request.resumedFromRunId } : {}),
        createdAt: now,
        updatedAt: now
      };
      await atomicWriteFile(runPath, `${JSON.stringify(run, null, 2)}\n`);
      return run;
    } finally {
      await lock.release();
    }
  }

  async createRunEvidence(request: {
    sessionId: string;
    runId: string;
    traceId: string;
    label: string;
    type: RunEvidenceType;
    content: string | unknown;
  }): Promise<RunEvidenceRecord> {
    await this.ensureRunEvidenceDirectory();
    const lock = await acquireSessionLock(this.runEvidenceLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const normalizedLabel = request.label.trim();
      if (!normalizedLabel) {
        throw new AthenaError("CONFIG_ERROR", "runEvidence.create.label must be non-empty.");
      }
      const evidenceId = await this.allocateRunEvidenceId(request.runId);
      const content = normalizeRunEvidenceContent(request.type, request.content);
      const createdAt = this.issueMonotonicIsoTimestamp();
      const evidencePath = this.resolveRunEvidencePath(request.runId, evidenceId);
      const artifactRef = `run-evidence/${request.runId}/${evidenceId}.json`;
      const record: RunEvidenceRecord = {
        schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
        id: evidenceId,
        sessionId: request.sessionId,
        runId: request.runId,
        traceId: request.traceId,
        label: normalizedLabel,
        type: request.type,
        content,
        createdAt,
        artifactRef,
        sizeBytes: Buffer.byteLength(JSON.stringify(content), "utf8")
      };
      await atomicWriteFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`);
      return record;
    } finally {
      await lock.release();
    }
  }

  async listRunEvidence(runId: string): Promise<RunEvidenceRecord[]> {
    await this.ensureRunEvidenceDirectory();
    const evidenceDir = this.resolveRunEvidenceDirectoryPath(runId);
    if (!existsSync(evidenceDir)) {
      return [];
    }
    const fileNames = await readdir(evidenceDir);
    const records: RunEvidenceRecord[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const evidencePath = this.resolveRunEvidencePath(runId, fileName.slice(0, -".json".length));
      if (!existsSync(evidencePath)) {
        continue;
      }
      const raw = await readFile(evidencePath, "utf8");
      records.push(normalizeRunEvidenceRecord(JSON.parse(raw) as unknown, evidencePath));
    }
    records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return records;
  }

  async listSessionRunEvidence(sessionId: string): Promise<RunEvidenceRecord[]> {
    assertValidSessionId(sessionId);
    await this.ensureRunEvidenceDirectory();
    const entries = await readdir(this.runEvidenceDir, { withFileTypes: true });
    const records: RunEvidenceRecord[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const runRecords = await this.listRunEvidence(entry.name);
      for (const record of runRecords) {
        if (record.sessionId === sessionId) {
          records.push(record);
        }
      }
    }
    records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return records;
  }

  async getRunEvidence(runId: string, evidenceId: string): Promise<RunEvidenceRecord | undefined> {
    await this.ensureRunEvidenceDirectory();
    const evidencePath = this.resolveRunEvidencePath(runId, evidenceId);
    if (!existsSync(evidencePath)) {
      return undefined;
    }
    const raw = await readFile(evidencePath, "utf8");
    return normalizeRunEvidenceRecord(JSON.parse(raw) as unknown, evidencePath);
  }

  async transitionWorkflowRun(
    workflowId: string,
    runId: string,
    transition: (run: WorkflowRun) => WorkflowRun
  ): Promise<WorkflowRun> {
    await this.ensureWorkflowRunDirectory(workflowId);
    const lock = await acquireSessionLock(this.workflowRunsLockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const runPath = this.resolveWorkflowRunPath(workflowId, runId);
      if (!existsSync(runPath)) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `workflowRuns.transition requires an existing run. Received workflowId=${workflowId}, runId=${runId}.`
        );
      }
      const raw = await readFile(runPath, "utf8");
      const current = normalizeWorkflowRun(JSON.parse(raw) as unknown, runPath, workflowId);
      const next = transition(current);
      if (next.id !== current.id || next.workflowId !== current.workflowId) {
        throw new AthenaError("SESSION_IO_ERROR", "workflowRuns.transition cannot mutate workflowId or runId.");
      }
      await atomicWriteFile(runPath, `${JSON.stringify(next, null, 2)}\n`);
      return next;
    } finally {
      await lock.release();
    }
  }

  listSchedules(): Promise<ScheduledTask[]> {
    return this.scheduleManager.listTasks();
  }

  async getScheduleLogs(scheduleId: string, options: { limit?: number } = {}): Promise<ScheduleRunLog[]> {
    assertValidScheduleId(scheduleId);
    return this.scheduleManager.readLogs(scheduleId, options.limit ?? 20);
  }

  private async ensureDirectivesDirectory(): Promise<void> {
    await mkdir(this.directivesDir, { recursive: true });
  }

  private async ensureHarnessProfilesDirectory(): Promise<void> {
    await mkdir(this.harnessProfilesDir, { recursive: true });
  }

  private async ensureRunTemplatesDirectory(): Promise<void> {
    await mkdir(this.runTemplatesDir, { recursive: true });
  }

  private async ensureWorkflowsDirectory(): Promise<void> {
    await mkdir(this.workflowsDir, { recursive: true });
  }

  private async ensureWorkflowRunDirectory(workflowId: string): Promise<string> {
    await mkdir(this.workflowRunsDir, { recursive: true });
    const workflowRunDir = this.resolveWorkflowRunDirectoryPath(workflowId);
    await mkdir(workflowRunDir, { recursive: true });
    return workflowRunDir;
  }

  private async ensureRunEvidenceDirectory(): Promise<void> {
    await mkdir(this.runEvidenceDir, { recursive: true });
  }

  private resolveDirectivePath(id: string): string {
    return resolveJsonPathWithinRoot(this.directivesDir, id, "directives directory");
  }

  private resolveHarnessProfilePath(id: string): string {
    return resolveJsonPathWithinRoot(this.harnessProfilesDir, id, "harness-profiles directory");
  }

  private resolveRunTemplatePath(id: string): string {
    return resolveJsonPathWithinRoot(this.runTemplatesDir, id, "run-templates directory");
  }

  private resolveWorkflowPath(id: string): string {
    return resolveJsonPathWithinRoot(this.workflowsDir, id, "workflows directory");
  }

  private resolveWorkflowRunDirectoryPath(workflowId: string): string {
    return resolvePathWithinRoot(this.workflowRunsDir, workflowId, "workflow-runs directory");
  }

  private resolveWorkflowRunPath(workflowId: string, runId: string): string {
    const workflowRunDir = this.resolveWorkflowRunDirectoryPath(workflowId);
    return resolveJsonPathWithinRoot(workflowRunDir, runId, "workflow run directory");
  }

  private resolveRunEvidenceDirectoryPath(runId: string): string {
    return resolvePathWithinRoot(this.runEvidenceDir, runId, "run-evidence directory");
  }

  private resolveRunEvidencePath(runId: string, evidenceId: string): string {
    const evidenceDir = this.resolveRunEvidenceDirectoryPath(runId);
    return resolveJsonPathWithinRoot(evidenceDir, evidenceId, "run evidence directory");
  }

  private async allocateDirectiveId(): Promise<string> {
    return allocateUniqueId(this.resolveDirectivePath.bind(this), "Unable to allocate unique directive ID.");
  }

  private async allocateHarnessProfileId(): Promise<string> {
    return allocateUniqueId(this.resolveHarnessProfilePath.bind(this), "Unable to allocate unique harness profile ID.");
  }

  private async allocateRunTemplateId(): Promise<string> {
    return allocateUniqueId(this.resolveRunTemplatePath.bind(this), "Unable to allocate unique run template ID.");
  }

  private async allocateWorkflowId(): Promise<string> {
    return allocateUniqueId(this.resolveWorkflowPath.bind(this), "Unable to allocate unique workflow ID.");
  }

  private async allocateWorkflowRunId(workflowId: string): Promise<string> {
    return allocateUniqueId(
      (id) => this.resolveWorkflowRunPath(workflowId, id),
      "Unable to allocate unique workflow run ID."
    );
  }

  private async allocateRunEvidenceId(runId: string): Promise<string> {
    const evidenceDir = this.resolveRunEvidenceDirectoryPath(runId);
    await mkdir(evidenceDir, { recursive: true });
    return allocateUniqueId(
      (id) => resolveJsonPathWithinRoot(evidenceDir, id, "run evidence directory"),
      "Unable to allocate unique run evidence ID."
    );
  }

  private issueMonotonicIsoTimestamp(): string {
    const nowMs = Date.now();
    const effectiveMs = nowMs > this.lastIssuedTimestampMs ? nowMs : this.lastIssuedTimestampMs + 1;
    this.lastIssuedTimestampMs = effectiveMs;
    return new Date(effectiveMs).toISOString();
  }
}
