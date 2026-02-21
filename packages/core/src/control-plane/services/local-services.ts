import { randomUUID } from "node:crypto";
import { ScheduleManager, type UpsertScheduleRequest } from "../../schedule/index.js";
import { AthenaError } from "../../runtime/errors.js";
import { assertValidSessionId } from "../../runtime/session-store.js";
import { transcriptStreamBroker, type TranscriptSubscription } from "../../runtime/transcript-stream.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  Directive,
  DirectiveCreateRequest,
  DirectiveListQuery,
  DirectiveListResult,
  EventEmitRequest,
  HarnessProfile,
  HarnessProfileCreateRequest,
  HarnessProfileListQuery,
  HarnessProfileListResult,
  RunTemplate,
  RunTemplateCreateRequest,
  RunTemplateListQuery,
  RunTemplateListResult,
  RunResult,
  ScheduleRunLog,
  ScheduledTask,
  SessionArtifactContent,
  SessionArtifactFormat,
  SessionArtifactRecord,
  SessionArtifactSummary,
  SessionSearchQuery,
  SessionSearchResult,
  SessionSearchResultItem,
  SessionSearchStatus,
  SessionRecord,
  TemplateRunRequest,
  TranscriptEntry,
  WorkQueueState
} from "../../shared/contracts.js";
import { WorkManager, type DrainResult, type EnqueueWorkRequest } from "../../work/index.js";
import {
  createMemoryManager,
  type MemoryGetRequest,
  type MemoryGetResult,
  type MemorySearchOptions
} from "../../memory/index.js";
import { runSpecialist, type SpecialistRunRequest } from "../../specialists/run.js";
import type { SpecialistRunResult } from "../../specialists/types.js";
import { createDefaultProviderRegistry } from "../../providers/index.js";
import type { ExecutionBackend } from "../backends.js";
import type {
  DirectiveService,
  EventService,
  HarnessProfileService,
  LspService,
  MemoryService,
  PersonaService,
  SpecialistService,
  PolicyService,
  RunService,
  RunTemplateService,
  ScheduleService,
  SessionService,
  WorkService
} from "../interfaces.js";
import type { StateStore } from "../state-store.js";
import { clampLimit, decodeOffsetCursor, encodeOffsetCursor } from "./pagination.js";

export class LocalSessionService implements SessionService {
  private searchIndex = new Map<string, SessionSearchIndexEntry>();
  private indexedAt = 0;
  private readonly indexTtlMs = 10_000;

  constructor(private readonly stateStore: StateStore) {}

  listSessions(): Promise<SessionRecord[]> {
    return this.stateStore.listSessions();
  }

  getSession(sessionId: string): Promise<SessionRecord | undefined> {
    return this.stateStore.getSession(sessionId);
  }

  getTranscript(sessionId: string, options?: { limit?: number; after?: string }): Promise<TranscriptEntry[]> {
    return this.stateStore.getTranscript(sessionId, options);
  }

  async searchSessions(query: SessionSearchQuery): Promise<SessionSearchResult> {
    const startedAt = Date.now();
    await this.refreshSearchIndexIfNeeded();

    const normalizedQuery = query.query.trim().toLowerCase();
    const personaFilter = query.personaId?.trim().toLowerCase();
    const userFilter = query.userId?.trim().toLowerCase();
    const fromMs = query.from ? Date.parse(query.from) : undefined;
    const toMs = query.to ? Date.parse(query.to) : undefined;
    const limit = clampSearchLimit(query.limit);
    const hits: SessionSearchResultItem[] = [];

    for (const entry of this.searchIndex.values()) {
      if (!passesDateFilter(entry.session.updatedAt, fromMs, toMs)) {
        continue;
      }
      if (personaFilter && !entry.personaIds.has(personaFilter)) {
        continue;
      }
      if (userFilter && !entry.userIds.has(userFilter)) {
        continue;
      }
      if (query.status && query.status !== entry.status) {
        continue;
      }

      const match = findBestTranscriptMatch(entry.entries, normalizedQuery);
      if (!match) {
        continue;
      }
      hits.push({
        session: entry.session,
        snippet: match.snippet,
        ...(match.entryId ? { snippetEntryId: match.entryId } : {}),
        matchedAt: match.matchedAt,
        status: entry.status,
        ...(entry.personaId ? { personaId: entry.personaId } : {}),
        ...(entry.userId ? { userId: entry.userId } : {})
      });
    }

    hits.sort((left, right) => right.session.updatedAt.localeCompare(left.session.updatedAt));
    const tookMs = Date.now() - startedAt;
    return {
      items: hits.slice(0, limit),
      total: hits.length,
      tookMs
    };
  }

  async subscribeTranscript(sessionId: string, listener: (entry: TranscriptEntry) => void): Promise<TranscriptSubscription> {
    assertValidSessionId(sessionId);
    return transcriptStreamBroker.subscribe(sessionId, listener);
  }

  async listArtifacts(sessionId: string): Promise<SessionArtifactSummary[]> {
    assertValidSessionId(sessionId);
    const [artifacts, transcript] = await Promise.all([
      this.stateStore.listSessionRunEvidence(sessionId),
      this.stateStore.getTranscript(sessionId)
    ]);
    const transcriptIdsByRun = mapTranscriptEntryIdsByRunId(transcript);
    return artifacts.map((artifact) => {
      const transcriptEntryId = transcriptIdsByRun.get(artifact.runId);
      return {
        id: artifact.id,
        runId: artifact.runId,
        sessionId: artifact.sessionId,
        traceId: artifact.traceId,
        label: artifact.label,
        type: artifact.type,
        format: resolveArtifactFormat(artifact.label, artifact.type, artifact.content),
        artifactRef: artifact.artifactRef,
        sizeBytes: artifact.sizeBytes,
        createdAt: artifact.createdAt,
        ...(typeof transcriptEntryId === "string" ? { transcriptEntryId } : {})
      };
    });
  }

  async getArtifact(sessionId: string, runId: string, artifactId: string): Promise<SessionArtifactRecord | undefined> {
    assertValidSessionId(sessionId);
    const artifact = await this.stateStore.getRunEvidence(runId, artifactId);
    if (!artifact || artifact.sessionId !== sessionId) {
      return undefined;
    }
    const transcript = await this.stateStore.getTranscript(sessionId);
    const transcriptEntryId = mapTranscriptEntryIdsByRunId(transcript).get(runId);
    return {
      id: artifact.id,
      runId: artifact.runId,
      sessionId: artifact.sessionId,
      traceId: artifact.traceId,
      label: artifact.label,
      type: artifact.type,
      format: resolveArtifactFormat(artifact.label, artifact.type, artifact.content),
      artifactRef: artifact.artifactRef,
      sizeBytes: artifact.sizeBytes,
      createdAt: artifact.createdAt,
      ...(transcriptEntryId ? { transcriptEntryId } : {}),
      content: mapArtifactContent(artifact.content)
    };
  }

  private async refreshSearchIndexIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.indexedAt < this.indexTtlMs) {
      return;
    }
    const sessions = await this.stateStore.listSessions();
    const activeIds = new Set<string>();
    for (const session of sessions) {
      activeIds.add(session.id);
      const current = this.searchIndex.get(session.id);
      if (current && current.session.updatedAt === session.updatedAt) {
        continue;
      }
      const transcript = await this.stateStore.getTranscript(session.id);
      this.searchIndex.set(session.id, buildSearchIndexEntry(session, transcript));
    }
    for (const sessionId of this.searchIndex.keys()) {
      if (!activeIds.has(sessionId)) {
        this.searchIndex.delete(sessionId);
      }
    }
    this.indexedAt = now;
  }
}

interface SessionSearchIndexEntry {
  session: SessionRecord;
  entries: TranscriptEntry[];
  status: SessionSearchStatus;
  personaIds: Set<string>;
  userIds: Set<string>;
  personaId?: string;
  userId?: string;
}

function buildSearchIndexEntry(session: SessionRecord, entries: TranscriptEntry[]): SessionSearchIndexEntry {
  const personaIds = new Set<string>();
  const userIds = new Set<string>();
  for (const entry of entries) {
    const personaId = resolvePersonaId(entry.metadata);
    const userId = resolveUserId(entry.metadata);
    if (personaId) {
      personaIds.add(personaId);
    }
    if (userId) {
      userIds.add(userId);
    }
  }
  return {
    session,
    entries,
    status: entries.some((entry) => entry.isError) ? "failed" : "ok",
    personaIds,
    userIds,
    ...(personaIds.size > 0 ? { personaId: [...personaIds][0] } : {}),
    ...(userIds.size > 0 ? { userId: [...userIds][0] } : {})
  };
}

function resolvePersonaId(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) {
    return undefined;
  }
  const value =
    metadata.specialistId ??
    metadata.specialistName ??
    metadata.specialist ??
    metadata.personaId ??
    metadata.personaName ??
    metadata.persona;
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function resolveUserId(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) {
    return undefined;
  }
  const value = metadata.userId ?? metadata.user;
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function findBestTranscriptMatch(
  entries: TranscriptEntry[],
  query: string
): { snippet: string; matchedAt: string; entryId?: string } | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  if (!query) {
    const latest = entries[entries.length - 1]!;
    return {
      snippet: toSnippet(latest.content, -1, 180),
      matchedAt: latest.createdAt,
      entryId: latest.id
    };
  }
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i]!;
    const index = entry.content.toLowerCase().indexOf(query);
    if (index >= 0) {
      return {
        snippet: toSnippet(entry.content, index, query.length),
        matchedAt: entry.createdAt,
        entryId: entry.id
      };
    }
  }
  return undefined;
}

function toSnippet(content: string, hitIndex: number, tokenLength: number): string {
  const normalized = content.trim();
  if (!normalized) {
    return "";
  }
  const radius = 90;
  if (hitIndex < 0) {
    return normalized.length <= radius * 2 ? normalized : `${normalized.slice(0, radius * 2)}...`;
  }
  const start = Math.max(0, hitIndex - radius);
  const end = Math.min(normalized.length, hitIndex + tokenLength + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function passesDateFilter(updatedAt: string, fromMs?: number, toMs?: number): boolean {
  const updatedAtMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedAtMs)) {
    return false;
  }
  if (fromMs !== undefined && updatedAtMs < fromMs) {
    return false;
  }
  if (toMs !== undefined && updatedAtMs > toMs) {
    return false;
  }
  return true;
}

function clampSearchLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(200, Math.floor(limit as number)));
}

function mapTranscriptEntryIdsByRunId(entries: TranscriptEntry[]): Map<string, string> {
  const byRunId = new Map<string, string>();
  for (const entry of entries) {
    const runId = entry.metadata?.runId;
    if (runId && !byRunId.has(runId)) {
      byRunId.set(runId, entry.id);
    }
  }
  return byRunId;
}

function mapArtifactContent(content: {
  kind: "text";
  text: string;
} | {
  kind: "json";
  value: unknown;
} | {
  kind: "binary";
  base64: string;
}): SessionArtifactContent {
  if (content.kind === "text") {
    return {
      kind: "text",
      text: content.text
    };
  }
  if (content.kind === "json") {
    return {
      kind: "json",
      value: content.value
    };
  }
  return {
    kind: "binary",
    base64: content.base64
  };
}

function resolveArtifactFormat(
  label: string,
  type: "text" | "json" | "binary",
  content?: SessionArtifactContent | { kind: "text"; text: string } | { kind: "json"; value: unknown } | { kind: "binary"; base64: string }
): SessionArtifactFormat {
  if (type === "json") {
    return "json";
  }
  const normalized = label.trim().toLowerCase();
  if (normalized.endsWith(".md") || normalized.endsWith(".markdown")) {
    return "markdown";
  }
  if (type === "binary") {
    if (
      normalized.endsWith(".png") ||
      normalized.endsWith(".jpg") ||
      normalized.endsWith(".jpeg") ||
      normalized.endsWith(".gif") ||
      normalized.endsWith(".webp") ||
      normalized.endsWith(".svg")
    ) {
      return "image";
    }
    return "binary";
  }
  if (content && "kind" in content && content.kind === "text") {
    const trimmed = content.text.trimStart();
    if (trimmed.startsWith("#") || trimmed.includes("\n## ")) {
      return "markdown";
    }
  }
  return "text";
}

export class LocalDirectiveService implements DirectiveService {
  constructor(private readonly stateStore: StateStore) {}

  async list(query: DirectiveListQuery = {}): Promise<DirectiveListResult> {
    const limit = clampLimit(query.limit ?? 50, 1, 500);
    const offset = decodeOffsetCursor(query.cursor);
    const directives = await this.stateStore.listDirectives();
    const items = directives.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      ...(nextOffset < directives.length ? { nextCursor: encodeOffsetCursor(nextOffset) } : {})
    };
  }

  create(request: DirectiveCreateRequest): Promise<Directive> {
    return this.stateStore.createDirective(request);
  }
}

export class LocalHarnessProfileService implements HarnessProfileService {
  private readonly availableProviders: Set<string>;
  private readonly allowedModels: Set<string>;

  constructor(
    private readonly stateStore: StateStore,
    private readonly config: AthenaConfig
  ) {
    this.availableProviders = new Set(createDefaultProviderRegistry(config).list());
    this.allowedModels = new Set([config.defaultModel]);
  }

  async list(query: HarnessProfileListQuery = {}): Promise<HarnessProfileListResult> {
    const limit = clampLimit(query.limit ?? 50, 1, 500);
    const offset = decodeOffsetCursor(query.cursor);
    const profiles = await this.stateStore.listHarnessProfiles();
    const items = profiles.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      ...(nextOffset < profiles.length ? { nextCursor: encodeOffsetCursor(nextOffset) } : {})
    };
  }

  async create(request: HarnessProfileCreateRequest): Promise<HarnessProfile> {
    this.assertValidProvider(request.config.provider);
    this.assertValidModel(request.config.model);
    this.assertValidAllowedEgress(request.allowedEgress);
    this.assertValidVerificationPolicies(request.verificationPolicies);
    return this.stateStore.createHarnessProfile(request);
  }

  private assertValidProvider(provider: string): void {
    if (this.availableProviders.has(provider)) {
      return;
    }
    throw new AthenaError(
      "CONFIG_ERROR",
      `harnessProfiles.create.config.provider must reference a configured provider. Received: ${provider}.`
    );
  }

  private assertValidModel(model: string): void {
    if (this.allowedModels.has(model)) {
      return;
    }
    throw new AthenaError(
      "CONFIG_ERROR",
      `harnessProfiles.create.config.model must match a configured model. Allowed: ${[...this.allowedModels].join(", ")}.`
    );
  }

  private assertValidVerificationPolicies(policies: HarnessProfileCreateRequest["verificationPolicies"]): void {
    if (!policies || policies.length === 0) {
      return;
    }
    const ids = new Set<string>();
    for (const policy of policies) {
      if (!policy.id.trim()) {
        throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.verificationPolicies.id must be non-empty.");
      }
      if (ids.has(policy.id)) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.verificationPolicies contains duplicate id '${policy.id}'.`
        );
      }
      ids.add(policy.id);
      if (policy.kind !== "require-evidence") {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.verificationPolicies.kind is unsupported: ${policy.kind}.`
        );
      }
      if (!policy.label.trim()) {
        throw new AthenaError("CONFIG_ERROR", "harnessProfiles.create.verificationPolicies.label must be non-empty.");
      }
    }
  }

  private assertValidAllowedEgress(allowedEgress: HarnessProfileCreateRequest["allowedEgress"]): void {
    if (!allowedEgress || allowedEgress.length === 0) {
      return;
    }
    const seen = new Set<string>();
    for (const [index, rule] of allowedEgress.entries()) {
      const host = rule.host.trim().toLowerCase();
      if (!isValidEgressHost(host)) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.allowedEgress[${index}].host must be a valid domain, wildcard domain, or IPv4 address.`
        );
      }
      if (rule.port !== undefined && (!Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535)) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.allowedEgress[${index}].port must be an integer between 1 and 65535.`
        );
      }
      const dedupe = `${host}:${rule.port ?? "*"}`;
      if (seen.has(dedupe)) {
        throw new AthenaError(
          "CONFIG_ERROR",
          `harnessProfiles.create.allowedEgress contains duplicate destination '${dedupe}'.`
        );
      }
      seen.add(dedupe);
    }
  }
}

function isValidEgressHost(value: string): boolean {
  if (isIpv4Host(value)) {
    return true;
  }
  if (isHostname(value)) {
    return true;
  }
  if (value.startsWith("*.")) {
    return isHostname(value.slice(2));
  }
  return false;
}

function isIpv4Host(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const parsed = Number.parseInt(part, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return false;
  }
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

export class LocalRunTemplateService implements RunTemplateService {
  constructor(
    private readonly stateStore: StateStore,
    private readonly runService: RunService
  ) {}

  async list(query: RunTemplateListQuery = {}): Promise<RunTemplateListResult> {
    const limit = clampLimit(query.limit ?? 50, 1, 500);
    const offset = decodeOffsetCursor(query.cursor);
    const templates = await this.stateStore.listRunTemplates();
    const items = templates.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      ...(nextOffset < templates.length ? { nextCursor: encodeOffsetCursor(nextOffset) } : {})
    };
  }

  async create(request: RunTemplateCreateRequest): Promise<RunTemplate> {
    await this.assertHarnessProfileExists(request.harnessProfileId);
    this.assertAllPlaceholdersAreAccountedFor(request.directiveTemplate, request.defaultParams);
    return this.stateStore.createRunTemplate(request);
  }

  async run(id: string, request: TemplateRunRequest = {}): Promise<RunResult> {
    const template = await this.resolveTemplate(id);
    const overrides = normalizeTemplateRunParams(request.params);
    const effectiveParams = {
      ...template.defaultParams,
      ...overrides
    };
    this.assertAllPlaceholdersAreAccountedFor(template.directiveTemplate, effectiveParams, "runTemplates.run.params");
    const input = renderDirectiveTemplate(template.directiveTemplate, effectiveParams);
    const sessionId = this.resolveTemplateRunSessionId(request.sessionId, template.id);
    const result = await this.runService.run({
      sessionId,
      input,
      harnessProfileId: template.harnessProfileId,
      metadata: {
        templateRun: "true",
        templateId: template.id,
        templateHarnessProfileId: template.harnessProfileId,
        templateEffectiveParams: JSON.stringify(effectiveParams)
      }
    });
    return {
      ...result,
      template: {
        id: template.id,
        harnessProfileId: template.harnessProfileId,
        effectiveParams
      }
    };
  }

  private async assertHarnessProfileExists(id: string): Promise<void> {
    const profiles = await this.stateStore.listHarnessProfiles();
    if (profiles.some((profile) => profile.id === id)) {
      return;
    }
    throw new AthenaError(
      "CONFIG_ERROR",
      `runTemplates.create.harnessProfileId must reference an existing harness profile. Received: ${id}.`
    );
  }

  private async resolveTemplate(id: string): Promise<RunTemplate> {
    const templates = await this.stateStore.listRunTemplates();
    const template = templates.find((item) => item.id === id);
    if (template) {
      return template;
    }
    throw new AthenaError("CONFIG_ERROR", `runTemplates.run.id must reference an existing run template. Received: ${id}.`);
  }

  private resolveTemplateRunSessionId(sessionId: string | undefined, templateId: string): string {
    if (sessionId) {
      assertValidSessionId(sessionId);
      return sessionId;
    }
    return `template-${templateId}-${randomUUID().slice(0, 12)}`;
  }

  private assertAllPlaceholdersAreAccountedFor(
    template: string,
    params: Record<string, string>,
    context: "runTemplates.create.defaultParams" | "runTemplates.run.params" = "runTemplates.create.defaultParams"
  ): void {
    const placeholders = extractDirectiveTemplatePlaceholders(template);
    const missing = [...placeholders].filter((name) => params[name] === undefined);
    if (missing.length === 0) {
      return;
    }
    throw new AthenaError(
      "CONFIG_ERROR",
      `${context} is missing values for placeholders: ${missing.sort().join(", ")}.`
    );
  }
}

export class LocalWorkService implements WorkService {
  private readonly manager: WorkManager;

  constructor(config: AthenaConfig, private readonly backend: ExecutionBackend) {
    this.manager = new WorkManager(config);
  }

  enqueue(request: EnqueueWorkRequest): Promise<WorkQueueState> {
    return this.manager.enqueue(request);
  }

  status(sessionId: string): Promise<WorkQueueState> {
    assertValidSessionId(sessionId);
    return this.manager.loadQueue(sessionId);
  }

  drain(sessionId: string, options: { provider?: string; model?: string } = {}): Promise<DrainResult> {
    assertValidSessionId(sessionId);
    return this.manager.drain(sessionId, async (batch) => {
      await this.backend.run({
        sessionId: batch.sessionId,
        input: batch.payload,
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {})
      });
    });
  }
}

export class LocalScheduleService implements ScheduleService {
  private readonly manager: ScheduleManager;

  constructor(
    private readonly config: AthenaConfig,
    private readonly backend: ExecutionBackend,
    private readonly policyService: PolicyService
  ) {
    this.manager = new ScheduleManager(config);
  }

  list(): Promise<ScheduledTask[]> {
    return this.manager.listTasks();
  }

  upsert(request: UpsertScheduleRequest): Promise<ScheduledTask> {
    return this.manager.upsertTask(request);
  }

  remove(id: string): Promise<boolean> {
    return this.manager.removeTask(id);
  }

  run(id: string, options: { provider?: string; model?: string } = {}) {
    return this.manager.runTask(id, async (task, runOptions) => {
      const timeoutMs = await this.resolveScheduleRunTimeoutMs();
      await this.backend.run(
        {
          sessionId: task.sessionId,
          input: task.input,
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.model ? { model: options.model } : {})
        },
        {
          ...(runOptions?.signal ? { signal: runOptions.signal } : {}),
          timeoutMs
        }
      );
    });
  }

  runDue(at: Date, options: { provider?: string; model?: string } = {}) {
    return this.manager.runDue(at, async (task, runOptions) => {
      const timeoutMs = await this.resolveScheduleRunTimeoutMs();
      await this.backend.run(
        {
          sessionId: task.sessionId,
          input: task.input,
          ...(options.provider ? { provider: options.provider } : {}),
          ...(options.model ? { model: options.model } : {})
        },
        {
          ...(runOptions?.signal ? { signal: runOptions.signal } : {}),
          timeoutMs
        }
      );
    });
  }

  logs(id: string, options: { limit?: number } = {}): Promise<ScheduleRunLog[]> {
    return this.manager.readLogs(id, options.limit ?? 20);
  }

  private async resolveScheduleRunTimeoutMs(): Promise<number> {
    const policy = await this.policyService.get();
    return policy?.defaultScheduleTimeoutMs ?? this.config.scheduleRunTimeoutMs;
  }
}

export class LocalMemoryService implements MemoryService {
  private readonly memoryManager;

  constructor(config: AthenaConfig) {
    this.memoryManager = createMemoryManager(config);
  }

  search(query: string, options: MemorySearchOptions = {}) {
    return this.memoryManager.search(query, options);
  }

  get(request: MemoryGetRequest): Promise<MemoryGetResult> {
    return this.memoryManager.get(request);
  }
}

import { readdir } from "node:fs/promises";
import { resolveSpecialistsDirectory } from "../../personas/loader.js";

// ... [skipping some imports]

export class LocalSpecialistService implements SpecialistService, PersonaService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly eventService: EventService,
    private readonly lspService?: LspService
  ) {}

  async list(): Promise<string[]> {
    const specialistsDir = resolveSpecialistsDirectory(this.config.workspaceRoot);
    if (!existsSync(specialistsDir)) {
      return [];
    }
    const entries = await readdir(specialistsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".json")))
      .map((entry) => entry.name.replace(/\.json$/, ""));
  }

  async run(request: SpecialistRunRequest): Promise<{ result: SpecialistRunResult; stdout: string }> {
    try {
      const response = await runSpecialist(request, this.config, {
        ...(this.lspService ? { lspService: this.lspService } : {})
      });
      await this.emitSpecialistEvent({
        type: "specialist.run.started",
        sessionId: response.result.sessionId,
        runId: response.result.runId,
        payload: {
          specialistName: response.result.specialistName ?? response.result.personaName,
          personaName: response.result.personaName,
          repoPath: response.result.repoPath,
          headRef: response.result.headRef,
          baseRef: response.result.baseRef
        }
      });
      await this.emitSpecialistEvent({
        type: "specialist.run.completed",
        sessionId: response.result.sessionId,
        runId: response.result.runId,
        payload: {
          specialistName: response.result.specialistName ?? response.result.personaName,
          personaName: response.result.personaName,
          status: response.result.status,
          artifacts: response.result.artifacts,
          ...(response.result.runtimeResult
            ? {
                provider: response.result.runtimeResult.provider,
                model: response.result.runtimeResult.model,
                ...(response.result.runtimeResult.usage ? { usage: response.result.runtimeResult.usage } : {})
              }
            : {})
        }
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emitSpecialistEvent({
        type: "specialist.run.failed",
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
        payload: {
          specialistName: request.name,
          personaName: request.name,
          repoPath: request.repoPath,
          headRef: request.headRef,
          ...(request.baseRef ? { baseRef: request.baseRef } : {}),
          error: message
        }
      });
      throw error;
    }
  }

  private async emitSpecialistEvent(event: EventEmitRequest): Promise<void> {
    try {
      await this.eventService.emit(event);
    } catch {
      // Specialist observability should be best-effort and never change run behavior.
    }
  }
}

export const LocalPersonaService = LocalSpecialistService;

const DIRECTIVE_TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

function extractDirectiveTemplatePlaceholders(template: string): Set<string> {
  const placeholders = new Set<string>();
  for (const match of template.matchAll(DIRECTIVE_TEMPLATE_PLACEHOLDER_PATTERN)) {
    const name = match[1]?.trim();
    if (name && name.length > 0) {
      placeholders.add(name);
    }
  }
  return placeholders;
}

function renderDirectiveTemplate(template: string, params: Record<string, string>): string {
  return template.replace(DIRECTIVE_TEMPLATE_PLACEHOLDER_PATTERN, (_match, key: string) => params[key] ?? "");
}

function normalizeTemplateRunParams(value: Record<string, string> | undefined): Record<string, string> {
  if (!value) {
    return {};
  }
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new AthenaError("CONFIG_ERROR", "runTemplates.run.params keys must be non-empty strings.");
    }
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AthenaError("CONFIG_ERROR", `runTemplates.run.params.${normalizedKey} must be a non-empty string.`);
    }
    params[normalizedKey] = entry.trim();
  }
  return params;
}
