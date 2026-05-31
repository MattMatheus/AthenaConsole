import { randomUUID } from "node:crypto";
import { ScheduleManager, type RunScheduleResult, type UpsertScheduleRequest } from "../../schedule/index.js";
import { AthenaError } from "../../runtime/errors.js";
import { assertValidSessionId } from "../../runtime/session-store.js";
import { transcriptStreamBroker, type TranscriptSubscription } from "../../runtime/transcript-stream.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  Directive,
  DirectiveCreateRequest,
  DirectiveListQuery,
  DirectiveListResult,
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
  ScheduleStatus,
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
  WorkflowTemplateInstantiateRequest,
  WorkQueueState
} from "../../shared/contracts.js";
import { WorkManager, type DrainResult, type EnqueueWorkRequest } from "../../work/index.js";
import {
  createMemoryManager,
  type MemoryGetRequest,
  type MemoryGetResult,
  type MemorySearchOptions
} from "../../memory/index.js";
import { createDefaultProviderRegistry } from "../../providers/index.js";
import type { ExecutionBackend } from "../backends.js";
import type {
  DirectiveService,
  EventService,
  HarnessProfileService,
  MemoryService,
  PolicyService,
  RunService,
  RunTemplateService,
  ScheduleService,
  SessionService,
  WorkService
} from "../interfaces.js";
import type { AppStateDatabase, ScheduleRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { StateStore } from "../state-store.js";
import { clampLimit, decodeOffsetCursor, encodeOffsetCursor } from "./pagination.js";
import { LocalTaskWorkbenchService } from "./task-workbench.js";
import { LocalWorkflowDagExecutorService } from "./workflow-dag-executor.js";
import { LocalWorkflowTemplateCatalogService } from "./workflow-template-catalog.js";

export class LocalSessionService implements SessionService {
  private searchIndex = new Map<string, SessionSearchIndexEntry>();
  private indexedAt = 0;
  private readonly indexTtlMs = 10_000;

  constructor(
    private readonly stateStore: StateStore,
    private readonly config: AthenaConfig
  ) {}

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
    const agentFilter = query.agentId?.trim().toLowerCase();
    const userFilter = query.userId?.trim().toLowerCase();
    const fromMs = query.from ? Date.parse(query.from) : undefined;
    const toMs = query.to ? Date.parse(query.to) : undefined;
    const limit = clampSearchLimit(query.limit);
    const hits: SessionSearchResultItem[] = [];

    for (const entry of this.searchIndex.values()) {
      if (!passesDateFilter(entry.session.updatedAt, fromMs, toMs)) {
        continue;
      }
      if (agentFilter && !entry.agentIds.has(agentFilter)) {
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
        ...(entry.agentId ? { agentId: entry.agentId } : {}),
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
    }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getArtifact(sessionId: string, runId: string, artifactId: string): Promise<SessionArtifactRecord | undefined> {
    assertValidSessionId(sessionId);
    const artifact = await this.stateStore.getRunEvidence(runId, artifactId);
    if (artifact && artifact.sessionId === sessionId) {
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

    return undefined;
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
  agentIds: Set<string>;
  userIds: Set<string>;
  agentId?: string;
  userId?: string;
}

function buildSearchIndexEntry(session: SessionRecord, entries: TranscriptEntry[]): SessionSearchIndexEntry {
  const agentIds = new Set<string>();
  const userIds = new Set<string>();
  for (const entry of entries) {
    const agentId = resolveAgentId(entry.metadata);
    const userId = resolveUserId(entry.metadata);
    if (agentId) {
      agentIds.add(agentId);
    }
    if (userId) {
      userIds.add(userId);
    }
  }
  return {
    session,
    entries,
    status: entries.some((entry) => entry.isError) ? "failed" : "ok",
    agentIds,
    userIds,
    ...(agentIds.size > 0 ? { agentId: [...agentIds][0] } : {}),
    ...(userIds.size > 0 ? { userId: [...userIds][0] } : {})
  };
}

function resolveAgentId(metadata: Record<string, string> | undefined): string | undefined {
  if (!metadata) {
    return undefined;
  }
  const value =
    metadata.agentId ??
    metadata.agentName ??
    metadata.agent ??
    metadata.agentId ??
    metadata.agentName ??
    metadata.agent;
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

function resolveTranscriptEntryId(
  idsByRunId: Map<string, string>,
  canonicalRunId: string,
  aliases: string[]
): string | undefined {
  const direct = idsByRunId.get(canonicalRunId);
  if (direct) {
    return direct;
  }
  for (const alias of aliases) {
    const match = idsByRunId.get(alias);
    if (match) {
      return match;
    }
  }
  return undefined;
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
  private readonly runningAppStateScheduleIds = new Set<string>();

  constructor(
    private readonly config: AthenaConfig,
    private readonly backend: ExecutionBackend,
    private readonly policyService: PolicyService,
    private readonly options: { appState?: AppStateDatabase } = {}
  ) {
    this.manager = new ScheduleManager(config);
  }

  async list(): Promise<ScheduledTask[]> {
    return [...(await this.listAppStateSchedules()), ...(await this.manager.listTasks())];
  }

  async get(id: string): Promise<ScheduledTask | undefined> {
    const appStateSchedule = this.withAppState((appState) => appState.schedules.get(id));
    if (appStateSchedule) {
      return mapScheduleRecord(appStateSchedule);
    }
    return (await this.manager.listTasks()).find((schedule) => schedule.id === id);
  }

  async upsert(request: UpsertScheduleRequest): Promise<ScheduledTask> {
    if (request.targetType) {
      return this.withAppState((appState) => {
        const targetId = request.targetId;
        if (!targetId) {
          throw new AthenaError("CONFIG_ERROR", "schedules.create.targetId is required.");
        }
        if (request.targetType === "task") {
          const task = appState.tasks.get(targetId);
          if (!task) {
            throw new AthenaError("PROVIDER_NOT_FOUND", `Scheduled task target not found: ${request.targetId ?? ""}`);
          }
          if (task.status !== "ready") {
            throw new AthenaError("CONFIG_ERROR", `Scheduled task target must be ready: ${task.id}`);
          }
        } else if (request.targetType === "workflow-template") {
          assertWorkflowTemplateScheduleTarget(appState, targetId, request.inputBindings);
        } else {
          throw new AthenaError("CONFIG_ERROR", `Unsupported schedule target type: ${request.targetType}`);
        }
        const timezone = request.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
        const nextRunAt = request.runAt ?? nextRunFromRRule(request.rrule);
        const status = request.status ?? statusFromEnabled(request.enabled);
        return mapScheduleRecord(
          appState.schedules.upsert({
            id: request.id,
            name: request.name ?? request.id,
            targetType: request.targetType,
            targetId,
            inputBindings: request.inputBindings ?? {},
            ...(request.rrule ? { rrule: request.rrule } : {}),
            timezone,
            status,
            nextRunAt,
            failurePolicy: request.failurePolicy ?? { overlap: "skip-if-running" }
          })
        );
      });
    }
    return this.manager.upsertTask(request);
  }

  async remove(id: string): Promise<boolean> {
    const removedAppStateSchedule = this.withAppState((appState) => appState.schedules.delete(id));
    if (removedAppStateSchedule) {
      return true;
    }
    return this.manager.removeTask(id);
  }

  async run(id: string, options: { provider?: string; model?: string } = {}) {
    const appStateSchedule = this.withAppState((appState) => appState.schedules.get(id));
    if (appStateSchedule) {
      return this.runAppStateSchedule(id, new Date(), options);
    }
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

  async runDue(at: Date, options: { provider?: string; model?: string } = {}) {
    const appStateResult = await this.runDueAppStateSchedules(at, options);
    const legacyResult = await this.manager.runDue(at, async (task, runOptions) => {
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
    return {
      run: [...appStateResult.run, ...legacyResult.run],
      skipped: appStateResult.skipped + legacyResult.skipped
    };
  }

  async logs(id: string, options: { limit?: number } = {}): Promise<ScheduleRunLog[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const appStateLogs = this.withAppState((appState) => {
      const schedule = appState.schedules.get(id);
      return schedule ? appState.scheduleRunHistory.listForSchedule(id, { limit }) : [];
    });
    const legacyLogs = await this.manager.readLogs(id, limit);
    return [...appStateLogs, ...legacyLogs]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit);
  }

  private async resolveScheduleRunTimeoutMs(): Promise<number> {
    const policy = await this.policyService.get();
    return policy?.defaultScheduleTimeoutMs ?? this.config.scheduleRunTimeoutMs;
  }

  private async listAppStateSchedules(): Promise<ScheduledTask[]> {
    return this.withAppState((appState) => appState.schedules.list().map(mapScheduleRecord));
  }

  private async runDueAppStateSchedules(
    at: Date,
    options: { provider?: string; model?: string } = {}
  ): Promise<{ run: RunScheduleResult[]; skipped: number }> {
    const { due, total } = this.withAppState((appState) => ({
      due: appState.schedules.list({ status: "active", dueAt: at }),
      total: appState.schedules.count()
    }));
    const run: RunScheduleResult[] = [];

    for (const schedule of due) {
      run.push(await this.runAppStateSchedule(schedule.id, at, options));
    }

    return {
      run,
      skipped: Math.max(0, total - due.length)
    };
  }

  private async runAppStateSchedule(
    id: string,
    at: Date,
    _options: { provider?: string; model?: string } = {}
  ): Promise<RunScheduleResult> {
    const startedAt = new Date().toISOString();
    if (this.runningAppStateScheduleIds.has(id)) {
      return this.withAppState((appState) => {
        const schedule = appState.schedules.get(id);
        const result: RunScheduleResult = {
          id,
          sessionId: schedule?.targetId ?? "unknown",
          status: "already-running",
          startedAt,
          finishedAt: startedAt,
          ...(schedule?.targetType ? { targetType: schedule.targetType } : {}),
          ...(schedule?.targetId ? { targetId: schedule.targetId } : {}),
          ...(schedule?.nextRunAt ? { nextRunAt: schedule.nextRunAt } : {}),
          reason: "skip-if-running"
        };
        if (schedule) {
          this.recordAppStateScheduleRun(appState, result);
        }
        return result;
      });
    }

    this.runningAppStateScheduleIds.add(id);
    try {
      return await this.withAppStateAsync(async (appState) => {
        const schedule = appState.schedules.get(id);
        if (!schedule) {
          throw new AthenaError("PROVIDER_NOT_FOUND", `Schedule not found: ${id}`);
        }

        const missedRunAt = schedule.nextRunAt && schedule.nextRunAt < at.toISOString() ? schedule.nextRunAt : undefined;
        if (schedule.targetType === "workflow-template") {
          return this.runWorkflowTemplateSchedule(appState, schedule, at, startedAt, missedRunAt);
        }
        if (schedule.targetType !== "task") {
          throw new AthenaError("CONFIG_ERROR", `Unsupported schedule target type: ${schedule.targetType}`);
        }
        const taskService = new LocalTaskWorkbenchService(this.config, { appState });
        try {
          const runId = `run-${randomUUID()}`;
          const taskRun = await taskService.runTask(schedule.targetId, { runId });
          const finishedAt = new Date().toISOString();
          const nextRunAt = nextRunAfterScheduleAttempt(schedule, at);
          const runSucceeded = taskRun.status === "completed";
          const nextStatus: ScheduleStatus = runSucceeded ? (nextRunAt ? "active" : "disabled") : "error";
          const resultStatus: RunScheduleResult["status"] = runSucceeded ? "ok" : "failed";
          const failurePolicy = updateScheduleFailurePolicy(schedule.failurePolicy, {
            status: resultStatus,
            runId: taskRun.id,
            attemptedAt: startedAt,
            ...(taskRun.status !== "completed" ? { runStatus: taskRun.status } : {})
          });
          const updated = appState.schedules.update(schedule.id, {
            status: nextStatus,
            lastRunId: taskRun.id,
            nextRunAt: nextRunAt ?? null,
            failurePolicy,
            now: new Date(finishedAt)
          });
          appState.runEvents.append({
            id: `event-${randomUUID()}`,
            runId: taskRun.id,
            taskId: schedule.targetId,
            ...(taskRun.agentId ? { agentId: taskRun.agentId } : {}),
            type: "schedule.run.linked",
            level: "info",
            message: `Schedule run linked: ${schedule.id}.`,
            payload: {
              scheduleId: schedule.id,
              scheduleName: schedule.name,
              targetType: schedule.targetType,
              targetId: schedule.targetId,
              scheduledRunAt: schedule.nextRunAt,
              ...(missedRunAt ? { missedRunAt } : {}),
              ...(updated.nextRunAt ? { nextRunAt: updated.nextRunAt } : {}),
              status: resultStatus
            }
          });
          const result: RunScheduleResult = {
            id: schedule.id,
            sessionId: schedule.targetId,
            status: resultStatus,
            startedAt,
            finishedAt,
            targetType: schedule.targetType,
            targetId: schedule.targetId,
            runId: taskRun.id,
            ...(updated.nextRunAt ? { nextRunAt: updated.nextRunAt } : {}),
            ...(missedRunAt ? { missedRunAt } : {}),
            ...(resultStatus === "failed" ? { reason: `task-run-${taskRun.status}` } : {})
          };
          this.recordAppStateScheduleRun(appState, result);
          return result;
        } catch (error) {
          const finishedAt = new Date().toISOString();
          const message = error instanceof Error ? error.message : String(error);
          const errorCode = error instanceof AthenaError ? error.code : undefined;
          const nextRunAt = nextRunAfterScheduleAttempt(schedule, at);
          const updated = appState.schedules.update(schedule.id, {
            status: "error",
            nextRunAt: nextRunAt ?? null,
            failurePolicy: updateScheduleFailurePolicy(schedule.failurePolicy, {
              status: "failed",
              attemptedAt: startedAt,
              error: message,
              ...(errorCode ? { errorCode } : {})
            }),
            now: new Date(finishedAt)
          });
          const result: RunScheduleResult = {
            id: schedule.id,
            sessionId: schedule.targetId,
            status: "failed",
            startedAt,
            finishedAt,
            targetType: schedule.targetType,
            targetId: schedule.targetId,
            ...(updated.nextRunAt ? { nextRunAt: updated.nextRunAt } : {}),
            ...(missedRunAt ? { missedRunAt } : {}),
            error: message,
            ...(errorCode ? { errorCode } : {})
          };
          this.recordAppStateScheduleRun(appState, result);
          return result;
        }
      });
    } finally {
      this.runningAppStateScheduleIds.delete(id);
    }
  }

  private async runWorkflowTemplateSchedule(
    appState: AppStateDatabase,
    schedule: ScheduleRecord,
    at: Date,
    startedAt: string,
    missedRunAt: string | undefined
  ): Promise<RunScheduleResult> {
    try {
      const templateService = new LocalWorkflowTemplateCatalogService(this.config, { appState });
      const instantiation = await templateService.instantiate(schedule.targetId, {
        ...workflowTemplateInstantiationRequestFromSchedule(schedule.inputBindings),
        createdBy: `schedule:${schedule.id}`
      });
      const executor = new LocalWorkflowDagExecutorService(this.config, { appState });
      const execution = await executor.execute(instantiation.workflowDagRun.id);
      const finishedAt = new Date().toISOString();
      const nextRunAt = nextRunAfterScheduleAttempt(schedule, at);
      const taskIds = instantiation.tasks.map((task) => task.id);
      const runSucceeded = execution.status === "completed";
      const resultStatus: RunScheduleResult["status"] = runSucceeded ? "ok" : "failed";
      const workflowFailure = execution.snapshot.run.failure;
      const failurePolicy = updateScheduleFailurePolicy(schedule.failurePolicy, {
        status: resultStatus,
        missionId: instantiation.mission.id,
        workflowDagRunId: instantiation.workflowDagRun.id,
        taskIds,
        workflowStatus: execution.status,
        attemptedAt: startedAt,
        template: instantiation.template,
        ...(workflowFailure !== undefined ? { workflowFailure } : {})
      });
      const updated = appState.schedules.update(schedule.id, {
        status: runSucceeded ? (nextRunAt ? "active" : "disabled") : "error",
        nextRunAt: nextRunAt ?? null,
        failurePolicy,
        now: new Date(finishedAt)
      });
      const result: RunScheduleResult = {
        id: schedule.id,
        sessionId: instantiation.mission.id,
        status: resultStatus,
        startedAt,
        finishedAt,
        targetType: schedule.targetType,
        targetId: schedule.targetId,
        workflowDagRunId: instantiation.workflowDagRun.id,
        missionId: instantiation.mission.id,
        taskIds,
        ...(updated.nextRunAt ? { nextRunAt: updated.nextRunAt } : {}),
        ...(missedRunAt ? { missedRunAt } : {}),
        ...(resultStatus === "failed" ? { reason: `workflow-dag-${execution.status}` } : {})
      };
      this.recordAppStateScheduleRun(appState, result);
      return result;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof AthenaError ? error.code : undefined;
      const nextRunAt = nextRunAfterScheduleAttempt(schedule, at);
      const updated = appState.schedules.update(schedule.id, {
        status: "error",
        nextRunAt: nextRunAt ?? null,
        failurePolicy: updateScheduleFailurePolicy(schedule.failurePolicy, {
          status: "failed",
          attemptedAt: startedAt,
          error: message,
          ...(errorCode ? { errorCode } : {})
        }),
        now: new Date(finishedAt)
      });
      const result: RunScheduleResult = {
        id: schedule.id,
        sessionId: schedule.targetId,
        status: "failed",
        startedAt,
        finishedAt,
        targetType: schedule.targetType,
        targetId: schedule.targetId,
        ...(updated.nextRunAt ? { nextRunAt: updated.nextRunAt } : {}),
        ...(missedRunAt ? { missedRunAt } : {}),
        error: message,
        ...(errorCode ? { errorCode } : {})
      };
      this.recordAppStateScheduleRun(appState, result);
      return result;
    }
  }

  private recordAppStateScheduleRun(appState: AppStateDatabase, result: RunScheduleResult): ScheduleRunLog {
    return appState.scheduleRunHistory.create({
      scheduleId: result.id,
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      status: result.status,
      ...(result.targetType ? { targetType: result.targetType } : {}),
      ...(result.targetId ? { targetId: result.targetId } : {}),
      ...(result.runId ? { runId: result.runId } : {}),
      ...(result.workflowDagRunId ? { workflowDagRunId: result.workflowDagRunId } : {}),
      ...(result.missionId ? { missionId: result.missionId } : {}),
      ...(result.taskIds ? { taskIds: result.taskIds } : {}),
      ...(result.nextRunAt ? { nextRunAt: result.nextRunAt } : {}),
      ...(result.missedRunAt ? { missedRunAt: result.missedRunAt } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.error ? { error: result.error } : {}),
      ...(result.errorCode ? { errorCode: result.errorCode } : {})
    });
  }

  private withAppState<T>(access: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return access(appState);
    } finally {
      appState.close();
    }
  }

  private async withAppStateAsync<T>(access: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    if (this.options.appState) {
      return access(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return await access(appState);
    } finally {
      appState.close();
    }
  }
}

function mapScheduleRecord(record: ScheduleRecord): ScheduledTask {
  return {
    schemaVersion: 1,
    id: record.id,
    name: record.name,
    targetType: record.targetType,
    targetId: record.targetId,
    inputBindings: record.inputBindings,
    ...(record.rrule ? { rrule: record.rrule } : {}),
    timezone: record.timezone,
    status: record.status,
    failurePolicy: record.failurePolicy,
    ...(record.lastRunId ? { lastRunId: record.lastRunId } : {}),
    ...(lastMissionIdFromSchedule(record) ? { lastMissionId: lastMissionIdFromSchedule(record) } : {}),
    sessionId: record.targetId,
    input: "",
    everyMinutes: 1,
    enabled: record.status === "active",
    running: false,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.lastRunId ? { lastRunAt: record.updatedAt } : {}),
    nextRunAt: record.nextRunAt ?? record.createdAt
  };
}

function assertWorkflowTemplateScheduleTarget(appState: AppStateDatabase, targetId: string, inputBindings: unknown): void {
  const request = workflowTemplateInstantiationRequestFromSchedule(inputBindings);
  const matches = appState.workflowTemplates.list().filter((template) => {
    return (
      template.id === targetId &&
      (!request.version || template.version === request.version) &&
      (!request.pluginId || template.pluginId === request.pluginId) &&
      (!request.pluginVersion || template.pluginVersion === request.pluginVersion)
    );
  });
  if (matches.length === 0) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Scheduled workflow template target not found: ${targetId}`);
  }
  if (matches.length > 1) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `Scheduled workflow template target is ambiguous: ${targetId}; provide version, pluginId, or pluginVersion.`
    );
  }
  const template = matches[0]!;
  const plugin = appState.plugins.get(template.pluginId, template.pluginVersion);
  if (!plugin || !plugin.enabled || plugin.status !== "loaded" || template.status !== "loaded") {
    throw new AthenaError("CONFIG_ERROR", `Scheduled workflow template target is not available: ${targetId}`);
  }
}

function lastMissionIdFromSchedule(record: ScheduleRecord): string | undefined {
  if (record.targetType !== "workflow-template" || !isRecord(record.failurePolicy)) {
    return undefined;
  }
  const lastAttempt = record.failurePolicy.lastAttempt;
  return isRecord(lastAttempt) && typeof lastAttempt.missionId === "string" ? lastAttempt.missionId : undefined;
}

function workflowTemplateInstantiationRequestFromSchedule(inputBindings: unknown): WorkflowTemplateInstantiateRequest {
  if (inputBindings === undefined || inputBindings === null) {
    return {};
  }
  if (!isRecord(inputBindings)) {
    throw new AthenaError("CONFIG_ERROR", "workflow-template schedule inputBindings must be an object.");
  }
  const inputs = inputBindings.inputs;
  if (inputs !== undefined && !isRecord(inputs)) {
    throw new AthenaError("CONFIG_ERROR", "workflow-template schedule inputBindings.inputs must be an object.");
  }
  return {
    ...(typeof inputBindings.version === "string" && inputBindings.version.trim() ? { version: inputBindings.version } : {}),
    ...(typeof inputBindings.pluginId === "string" && inputBindings.pluginId.trim() ? { pluginId: inputBindings.pluginId } : {}),
    ...(typeof inputBindings.pluginVersion === "string" && inputBindings.pluginVersion.trim()
      ? { pluginVersion: inputBindings.pluginVersion }
      : {}),
    ...(inputs ? { inputs } : {})
  };
}

function statusFromEnabled(enabled: boolean | undefined): ScheduleStatus {
  return enabled === false ? "paused" : "active";
}

function nextRunFromRRule(rrule: string | undefined): string | undefined {
  if (!rrule) {
    return undefined;
  }
  const countMatch = /COUNT=0(?:;|$)/i.exec(rrule);
  if (countMatch) {
    throw new AthenaError("CONFIG_ERROR", "schedules.create.rrule must allow at least one run.");
  }
  return new Date().toISOString();
}

function nextRunAfterScheduleAttempt(schedule: ScheduleRecord, at: Date): string | undefined {
  if (!schedule.rrule) {
    return undefined;
  }
  return nextRunAfterRRule(schedule.rrule, schedule.nextRunAt ?? at.toISOString(), at);
}

function nextRunAfterRRule(rrule: string, seedIso: string, after: Date): string {
  const parts = parseRRule(rrule);
  const frequency = parts.FREQ;
  const interval = parsePositiveInteger(parts.INTERVAL ?? "1", "INTERVAL");
  const intervalMs = intervalToMilliseconds(frequency, interval);
  const seedMs = Date.parse(seedIso);
  if (!Number.isFinite(seedMs)) {
    throw new AthenaError("CONFIG_ERROR", `schedules.rrule seed must be a valid ISO datetime: '${seedIso}'.`);
  }
  const afterMs = after.getTime();
  const nextMs =
    seedMs > afterMs ? seedMs : seedMs + (Math.floor((afterMs - seedMs) / intervalMs) + 1) * intervalMs;
  return new Date(nextMs).toISOString();
}

function parseRRule(rrule: string): Record<string, string> {
  const entries = rrule
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, value] = part.split("=");
      if (!key || !value) {
        throw new AthenaError("CONFIG_ERROR", `Unsupported RRULE part: '${part}'.`);
      }
      return [key.toUpperCase(), value.toUpperCase()] as const;
    });
  const parsed = Object.fromEntries(entries);
  if (!parsed.FREQ) {
    throw new AthenaError("CONFIG_ERROR", "schedules.rrule must include FREQ.");
  }
  return parsed;
}

function intervalToMilliseconds(frequency: string | undefined, interval: number): number {
  switch (frequency) {
    case "MINUTELY":
      return interval * 60_000;
    case "HOURLY":
      return interval * 60 * 60_000;
    case "DAILY":
      return interval * 24 * 60 * 60_000;
    case "WEEKLY":
      return interval * 7 * 24 * 60 * 60_000;
    default:
      throw new AthenaError("CONFIG_ERROR", `Unsupported schedules.rrule FREQ: '${frequency ?? ""}'.`);
  }
}

function parsePositiveInteger(raw: string, field: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0 || String(value) !== raw) {
    throw new AthenaError("CONFIG_ERROR", `schedules.rrule ${field} must be a positive integer.`);
  }
  return value;
}

function updateScheduleFailurePolicy(policy: unknown, attempt: Record<string, unknown>): Record<string, unknown> {
  const base = isRecord(policy) ? policy : {};
  return {
    ...base,
    overlap: typeof base.overlap === "string" ? base.overlap : "skip-if-running",
    lastAttempt: attempt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
