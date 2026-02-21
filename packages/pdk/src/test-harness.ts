import type {
  DependencyInspection,
  FindingPriority,
  PersonaDefinition,
  PersonaRunOutput,
  ReviewFinding
} from "./contracts.js";

const DEFAULT_MAX_FILE_CHARS = 20_000;
const DEFAULT_MAX_TOTAL_CHARS = 120_000;
const DEFAULT_DIFF_MAX_CHARS = 18_000;
const DEFAULT_CHANGED_FILES_MAX = 300;
const MODEL_OUTPUT_REPAIR_MAX_CHARS = 40_000;

export interface MockRuntimeRunRequest {
  sessionId: string;
  input: string;
  provider?: string;
  model?: string;
  metadata: Record<string, string>;
}

export interface MockRuntimeResponse {
  output: string;
  provider?: string;
  model?: string;
  createdAt?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  reliability?: unknown;
  contextMeta?: unknown;
}

export interface MockRuntimeOptions {
  responses?: Record<string, string | MockRuntimeResponse>;
  resolveResponse?: (request: MockRuntimeRunRequest, callIndex: number) => string | MockRuntimeResponse | undefined;
  defaultResponse?: string | MockRuntimeResponse;
  throwOnMissingInput?: boolean;
  nowIso?: () => string;
}

export class MockRuntime {
  private readonly responses: Map<string, MockRuntimeResponse>;
  private readonly resolveResponse: MockRuntimeOptions["resolveResponse"] | undefined;
  private readonly defaultResponse: MockRuntimeResponse | undefined;
  private readonly throwOnMissingInput: boolean;
  private readonly nowIso: () => string;
  private readonly calls: MockRuntimeRunRequest[] = [];

  public constructor(options: MockRuntimeOptions = {}) {
    this.responses = new Map(
      Object.entries(options.responses ?? {}).map(([input, response]) => [input, normalizeMockRuntimeResponse(response)])
    );
    this.resolveResponse = options.resolveResponse;
    this.defaultResponse = options.defaultResponse ? normalizeMockRuntimeResponse(options.defaultResponse) : undefined;
    this.throwOnMissingInput = options.throwOnMissingInput ?? true;
    this.nowIso = options.nowIso ?? (() => new Date().toISOString());
  }

  public getCalls(): readonly MockRuntimeRunRequest[] {
    return this.calls.map((call) => ({
      ...call,
      metadata: { ...call.metadata }
    }));
  }

  public async run(request: MockRuntimeRunRequest): Promise<MockRuntimeResponse> {
    this.calls.push({
      ...request,
      metadata: { ...request.metadata }
    });

    const callIndex = this.calls.length - 1;
    const mapped = this.responses.get(request.input);
    const resolved = this.resolveResponse?.(request, callIndex);
    const selected = mapped ?? (resolved ? normalizeMockRuntimeResponse(resolved) : undefined) ?? this.defaultResponse;

    if (!selected) {
      if (this.throwOnMissingInput) {
        throw new Error(`MockRuntime has no response mapped for input (call #${callIndex + 1}).`);
      }
      return {
        output: "",
        createdAt: this.nowIso(),
        provider: request.provider ?? "mock-runtime",
        model: request.model ?? "mock-model"
      };
    }

    return {
      ...selected,
      createdAt: selected.createdAt ?? this.nowIso(),
      provider: selected.provider ?? request.provider ?? "mock-runtime",
      model: selected.model ?? request.model ?? "mock-model"
    };
  }
}

function normalizeMockRuntimeResponse(response: string | MockRuntimeResponse): MockRuntimeResponse {
  if (typeof response === "string") {
    return { output: response };
  }
  return response;
}

export interface PersonaFileStateStore {
  readFile(path: string): Promise<string>;
}

export interface MockFileStateStoreOptions {
  files: Record<string, string>;
}

export class MockFileStateStore implements PersonaFileStateStore {
  private readonly files: Map<string, string>;

  public constructor(options: MockFileStateStoreOptions) {
    this.files = new Map(Object.entries(options.files));
  }

  public async readFile(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) {
      throw new Error(`MockFileStateStore missing file: ${path}`);
    }
    return value;
  }
}

export interface PersonaGitService {
  getDiff(baseRef: string, headRef: string, maxChars: number): Promise<string>;
  listChangedFiles(baseRef: string, headRef: string, maxFiles: number): Promise<string[]>;
}

export interface MockGitServiceOptions {
  diff?: string;
  changedFiles?: string[];
}

export class MockGitService implements PersonaGitService {
  private readonly diff: string;
  private readonly changedFiles: string[];

  public constructor(options: MockGitServiceOptions = {}) {
    this.diff = options.diff ?? "";
    this.changedFiles = options.changedFiles ? [...options.changedFiles] : [];
  }

  public async getDiff(_baseRef: string, _headRef: string, maxChars: number): Promise<string> {
    if (this.diff.length <= maxChars) {
      return this.diff;
    }
    return this.diff.slice(0, maxChars);
  }

  public async listChangedFiles(_baseRef: string, _headRef: string, maxFiles: number): Promise<string[]> {
    if (this.changedFiles.length <= maxFiles) {
      return [...this.changedFiles];
    }
    return this.changedFiles.slice(0, maxFiles);
  }
}

export interface PersonaTestHarnessOptions {
  persona: PersonaDefinition;
  runtime: MockRuntime;
  fileStateStore: PersonaFileStateStore;
  gitService: PersonaGitService;
  dependencyInspection?: DependencyInspection;
  referencedSnapshots?: Array<{
    sourcePath: string;
    importSpecifier: string;
    path: string;
    chars: number;
    truncated: boolean;
    content: string;
  }>;
  repoPath?: string;
  baseRef?: string;
  headRef?: string;
}

export interface PersonaTestHarnessRunRequest {
  sessionId?: string;
  provider?: string;
  model?: string;
}

export interface PersonaTestHarnessContextEntry {
  kind: "prompt" | "skill" | "doc";
  path: string;
  chars: number;
  truncated: boolean;
  truncationReason?: "max-file-chars" | "max-total-chars";
}

export interface PersonaTestHarnessResult {
  contextPack: {
    systemContent: string;
    userContent: string;
    entries: PersonaTestHarnessContextEntry[];
    includedFiles: string[];
  };
  prompt: string;
  runtimeCalls: MockRuntimeRunRequest[];
  parsedOutput: {
    parsed: boolean;
    parseRetryAttempted: boolean;
    parseError?: string;
    mergeGate: "pass" | "fail";
    findings: ReviewFinding[];
    reportMarkdown: string;
    dependencyInspection: DependencyInspection;
    rawOutput: string;
  };
  runOutput: PersonaRunOutput;
}

interface CuratedFileSection {
  kind: "prompt" | "skill" | "doc";
  path: string;
  content: string;
}

function withFileTruncation(content: string, maxFileChars: number, path: string): {
  text: string;
  truncated: boolean;
} {
  if (content.length <= maxFileChars) {
    return { text: content, truncated: false };
  }
  return {
    text: `${content.slice(0, maxFileChars)}\n\n[truncated to ${maxFileChars} chars: ${path}]\n`,
    truncated: true
  };
}

function withTotalBudgetTruncation(text: string, maxTotalChars: number, usedChars: number, path: string): {
  text: string;
  truncated: boolean;
} {
  if (usedChars + text.length <= maxTotalChars) {
    return { text, truncated: false };
  }

  const remaining = Math.max(0, maxTotalChars - usedChars);
  if (remaining === 0) {
    return {
      text: `[truncated: max total context budget ${maxTotalChars} reached before ${path}]\n`,
      truncated: true
    };
  }

  return {
    text: `${text.slice(0, remaining)}\n\n[truncated: max total context budget ${maxTotalChars} reached while loading ${path}]\n`,
    truncated: true
  };
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

function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(1, Math.max(0, num));
}

function isFindingPriority(value: unknown): value is FindingPriority {
  return value === "P1" || value === "P2" || value === "P3";
}

function parseModelOutput(raw: string): { parsed?: { mergeGate: "pass" | "fail"; reportMarkdown: string; findings: ReviewFinding[]; dependencyInspection?: { status: "ok" | "skipped"; notes?: string[] } }; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "Model output was not a JSON object." };
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.schemaVersion !== 1) {
    return { error: "Model output schemaVersion missing or unsupported." };
  }
  if (payload.mergeGate !== "pass" && payload.mergeGate !== "fail") {
    return { error: "Model output missing mergeGate ('pass'|'fail')." };
  }
  if (typeof payload.reportMarkdown !== "string") {
    return { error: "Model output missing reportMarkdown string." };
  }
  if (!Array.isArray(payload.findings)) {
    return { error: "Model output missing findings array." };
  }

  const findings: ReviewFinding[] = [];
  for (let index = 0; index < payload.findings.length; index += 1) {
    const finding = payload.findings[index];
    if (!finding || typeof finding !== "object") {
      return { error: "Model output findings contained a non-object entry." };
    }
    const candidate = finding as Record<string, unknown>;
    if (!isFindingPriority(candidate.priority)) {
      return { error: "Model output finding priority must be one of P1|P2|P3." };
    }
    if (typeof candidate.title !== "string" || typeof candidate.message !== "string") {
      return { error: "Model output finding title/message must be strings." };
    }
    if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence)) {
      return { error: "Model output finding confidence must be a finite number." };
    }

    findings.push({
      priority: candidate.priority,
      confidence: clampConfidence(candidate.confidence),
      title: candidate.title,
      message: candidate.message,
      ...(typeof candidate.suggestion === "string" ? { suggestion: candidate.suggestion } : {}),
      ...(typeof candidate.file === "string" ? { file: candidate.file } : {}),
      ...(typeof candidate.line === "number" ? { line: candidate.line } : {})
    });
  }

  if (findings.some((finding) => finding.priority === "P1") && payload.mergeGate !== "fail") {
    return { error: "Model output mergeGate must be 'fail' when any P1 finding exists." };
  }

  let dependencyInspection: { status: "ok" | "skipped"; notes?: string[] } | undefined;
  if (payload.dependencyInspection && typeof payload.dependencyInspection === "object") {
    const candidate = payload.dependencyInspection as Record<string, unknown>;
    if (candidate.status === "ok" || candidate.status === "skipped") {
      dependencyInspection = {
        status: candidate.status,
        ...(Array.isArray(candidate.notes) ? { notes: candidate.notes.filter((note) => typeof note === "string") as string[] } : {})
      };
    }
  }

  return {
    parsed: {
      mergeGate: payload.mergeGate,
      reportMarkdown: payload.reportMarkdown,
      findings,
      ...(dependencyInspection ? { dependencyInspection } : {})
    }
  };
}

function renderSection(kind: CuratedFileSection["kind"], path: string, content: string): string {
  const title = kind === "prompt" ? "Prompt File" : kind === "skill" ? "Skill File" : "Doc File";
  return [`### ${title}: ${path}`, content].join("\n");
}

function buildReferencedFileContext(
  snapshots: NonNullable<PersonaTestHarnessOptions["referencedSnapshots"]>
): string {
  return (
    snapshots
      .map((snapshot) =>
        [
          "---",
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

function buildPrompt(options: {
  persona: PersonaDefinition;
  contextPack: {
    systemContent: string;
    userContent: string;
    entries: PersonaTestHarnessContextEntry[];
  };
  repoPath: string;
  baseRef: string;
  headRef: string;
  changedFiles: string[];
  diff: string;
  dependencyInspection: DependencyInspection;
  referencedSnapshots: NonNullable<PersonaTestHarnessOptions["referencedSnapshots"]>;
}): string {
  const manifestSummary = JSON.stringify(
    {
      schemaVersion: 1,
      personaId: options.persona.id,
      totals: {
        requestedFiles: options.contextPack.entries.length,
        loadedFiles: options.contextPack.entries.length,
        loadedChars: options.contextPack.entries.reduce((total, entry) => total + entry.chars, 0),
        truncatedFiles: options.contextPack.entries.filter((entry) => entry.truncated).length
      },
      limits: {
        maxFileChars: options.persona.context?.maxFileChars ?? DEFAULT_MAX_FILE_CHARS,
        maxTotalChars: options.persona.context?.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS
      }
    },
    null,
    2
  );

  const rubric = options.persona.review?.rubric ?? {
    correctness: true,
    security: true,
    performance: true,
    maintainability: true,
    testGaps: true
  };

  return [
    "SYSTEM:",
    "You are Athena's code review persona.",
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
    "- Suggestions only. Do not claim to have applied changes.",
    "- Use priority P1 for critical correctness/security issues; P2 for important maintainability/test gaps; P3 for nits/nice-to-haves.",
    "- Confidence must be a float in [0,1].",
    "- mergeGate MUST be 'fail' when any P1 finding exists.",
    "- If dependency inspection cannot be performed, set dependencyInspection.status='skipped' and explain in notes.",
    "",
    "Curated persona context manifest summary:",
    manifestSummary,
    "",
    ...(options.contextPack.systemContent
      ? ["Curated system context (prompt + skill files, ordered):", options.contextPack.systemContent, ""]
      : []),
    "USER:",
    `Repo: ${options.repoPath}`,
    `Compare: ${options.baseRef}..${options.headRef}`,
    "",
    ...(options.contextPack.userContent ? ["Curated user context (doc files, ordered):", options.contextPack.userContent, ""] : []),
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
    buildReferencedFileContext(options.referencedSnapshots),
    "",
    "Diff (may be truncated):",
    options.diff
  ].join("\n");
}

export class PersonaTestHarness {
  private readonly persona: PersonaDefinition;
  private readonly runtime: MockRuntime;
  private readonly fileStateStore: PersonaFileStateStore;
  private readonly gitService: PersonaGitService;
  private readonly dependencyInspection: DependencyInspection;
  private readonly referencedSnapshots: NonNullable<PersonaTestHarnessOptions["referencedSnapshots"]>;
  private readonly repoPath: string;
  private readonly baseRef: string;
  private readonly headRef: string;

  public constructor(options: PersonaTestHarnessOptions) {
    this.persona = options.persona;
    this.runtime = options.runtime;
    this.fileStateStore = options.fileStateStore;
    this.gitService = options.gitService;
    this.dependencyInspection = options.dependencyInspection ?? { status: "skipped", notes: ["Not configured in test harness."] };
    this.referencedSnapshots = options.referencedSnapshots ?? [];
    this.repoPath = options.repoPath ?? ".";
    this.baseRef = options.baseRef ?? "main";
    this.headRef = options.headRef ?? "feature";
  }

  public async run(request: PersonaTestHarnessRunRequest = {}): Promise<PersonaTestHarnessResult> {
    const maxFileChars = this.persona.context?.maxFileChars ?? DEFAULT_MAX_FILE_CHARS;
    const maxTotalChars = this.persona.context?.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;

    const ordered: Array<{ kind: CuratedFileSection["kind"]; path: string }> = [
      ...(this.persona.context?.promptFiles ?? []).map((path) => ({ kind: "prompt" as const, path })),
      ...(this.persona.context?.skillFiles ?? []).map((path) => ({ kind: "skill" as const, path })),
      ...(this.persona.context?.docFiles ?? []).map((path) => ({ kind: "doc" as const, path }))
    ];

    const sections: CuratedFileSection[] = [];
    const entries: PersonaTestHarnessContextEntry[] = [];
    let loadedChars = 0;

    for (const item of ordered) {
      const raw = await this.fileStateStore.readFile(item.path);
      const fileCapped = withFileTruncation(raw, maxFileChars, item.path);
      const totalCapped = withTotalBudgetTruncation(fileCapped.text, maxTotalChars, loadedChars, item.path);
      const text = totalCapped.text;
      loadedChars += text.length;

      const truncationReason: PersonaTestHarnessContextEntry["truncationReason"] = totalCapped.truncated
        ? "max-total-chars"
        : fileCapped.truncated
          ? "max-file-chars"
          : undefined;

      entries.push({
        kind: item.kind,
        path: item.path,
        chars: text.length,
        truncated: Boolean(truncationReason),
        ...(truncationReason ? { truncationReason } : {})
      });
      sections.push({
        kind: item.kind,
        path: item.path,
        content: text
      });
    }

    const systemContent = sections
      .filter((section) => section.kind === "prompt" || section.kind === "skill")
      .map((section) => renderSection(section.kind, section.path, section.content))
      .join("\n\n");
    const userContent = sections
      .filter((section) => section.kind === "doc")
      .map((section) => renderSection(section.kind, section.path, section.content))
      .join("\n\n");

    const changedFiles = await this.gitService.listChangedFiles(this.baseRef, this.headRef, DEFAULT_CHANGED_FILES_MAX);
    const diff = await this.gitService.getDiff(this.baseRef, this.headRef, DEFAULT_DIFF_MAX_CHARS);
    const prompt = buildPrompt({
      persona: this.persona,
      contextPack: {
        systemContent,
        userContent,
        entries
      },
      repoPath: this.repoPath,
      baseRef: this.baseRef,
      headRef: this.headRef,
      changedFiles,
      diff,
      dependencyInspection: this.dependencyInspection,
      referencedSnapshots: this.referencedSnapshots
    });

    const sessionId = request.sessionId ?? "test-session";
    const firstResponse = await this.runtime.run({
      sessionId,
      input: prompt,
      ...(request.provider ? { provider: request.provider } : {}),
      ...(request.model ? { model: request.model } : {}),
      metadata: {
        trigger: "persona:run",
        persona: this.persona.id,
        repoPath: this.repoPath
      }
    });

    let parseRetryAttempted = false;
    let modelOutputRaw = firstResponse.output;
    let parsed = parseModelOutput(modelOutputRaw);

    if (!parsed.parsed) {
      parseRetryAttempted = true;
      const repairResponse = await this.runtime.run({
        sessionId,
        input: buildRepairPrompt(modelOutputRaw, parsed.error ?? "Invalid model output."),
        ...(request.provider ? { provider: request.provider } : {}),
        ...(request.model ? { model: request.model } : {}),
        metadata: {
          trigger: "persona:repair-json",
          persona: this.persona.id,
          repoPath: this.repoPath
        }
      });
      modelOutputRaw = repairResponse.output;
      parsed = parseModelOutput(modelOutputRaw);
    }

    const findings = parsed.parsed?.findings ?? [];
    const mergeGate: "pass" | "fail" =
      parsed.parsed?.mergeGate ?? (findings.some((finding) => finding.priority === "P1") ? "fail" : "pass");
    const dependencyInspection: DependencyInspection = {
      ...this.dependencyInspection,
      ...(parsed.parsed?.dependencyInspection?.status ? { status: parsed.parsed.dependencyInspection.status } : {}),
      ...(parsed.parsed?.dependencyInspection?.notes ? { notes: parsed.parsed.dependencyInspection.notes } : {})
    };

    const runOutput: PersonaRunOutput = {
      schemaVersion: 1,
      runId: "test-run",
      personaName: this.persona.id,
      sessionId,
      repoPath: this.repoPath,
      headRef: this.headRef,
      baseRef: this.baseRef,
      status: parsed.parsed ? "ok" : "failed",
      startedAt: "1970-01-01T00:00:00.000Z",
      finishedAt: "1970-01-01T00:00:00.000Z",
      findings,
      mergeGate,
      dependencyInspection,
      reportMarkdown: parsed.parsed?.reportMarkdown ?? modelOutputRaw,
      modelOutputRaw,
      modelOutputParsed: Boolean(parsed.parsed),
      parseRetryAttempted,
      ...(parsed.error ? { parseError: parsed.error } : {}),
      ...(!parsed.parsed ? { error: { message: parsed.error ?? "Failed to parse mock model output." } } : {})
    };

    return {
      contextPack: {
        systemContent,
        userContent,
        entries,
        includedFiles: entries.map((entry) => entry.path)
      },
      prompt,
      runtimeCalls: [...this.runtime.getCalls()],
      parsedOutput: {
        parsed: Boolean(parsed.parsed),
        parseRetryAttempted,
        ...(parsed.error ? { parseError: parsed.error } : {}),
        mergeGate,
        findings,
        reportMarkdown: parsed.parsed?.reportMarkdown ?? modelOutputRaw,
        dependencyInspection,
        rawOutput: modelOutputRaw
      },
      runOutput
    };
  }
}
