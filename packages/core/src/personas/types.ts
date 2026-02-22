export type PersonaOutputStdout = "summary" | "json" | "md" | "none";

export interface PersonaCuratedContextDefinition {
  promptFiles?: string[];
  skillFiles?: string[];
  docFiles?: string[];
  workspaceDocFiles?: string[];
  maxFileChars?: number;
  maxTotalChars?: number;
}

export interface PersonaSkillDefinition {
  id: string;
  title?: string;
  description?: string;
  category?: "analysis" | "generation" | "workflow" | "safety" | "integration";
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface PersonaDefinition {
  schemaVersion: number;
  id: string;
  description?: string;
  context?: PersonaCuratedContextDefinition;
  skills?: PersonaSkillDefinition[];
  git?: {
    baseRefDefault?: string;
    requireCleanWorktree?: boolean;
    baseRefAutodetect?: boolean;
  };
  review?: {
    scope?: "diff";
    inspectAddedDependencies?: boolean;
    includeGlobs?: string[];
    excludeGlobs?: string[];
    rubric?: Record<string, boolean>;
    maxReferencedFiles?: number;
    maxReferencedFileChars?: number;
  };
  output?: {
    defaultFormat?: "json" | "md" | "both";
    writeJsonFile?: boolean;
    writeMarkdownFile?: boolean;
    stdoutDefault?: PersonaOutputStdout;
  };
}

export type FindingPriority = "P1" | "P2" | "P3";

export interface ReviewFinding {
  priority: FindingPriority;
  confidence: number; // 0..1
  title: string;
  message: string;
  suggestion?: string;
  file?: string;
  line?: number;
}

export interface DependencyInspection {
  status: "ok" | "skipped";
  detectedEcosystem?: string;
  notes?: string[];
  addedImports?: string[];
  changedManifests?: string[];
}

export type PersonaContextSectionKind = "prompt" | "skill" | "doc";
export type PersonaContextTruncationReason = "max-file-chars" | "max-total-chars";

export interface PersonaContextManifestEntry {
  kind: PersonaContextSectionKind;
  path: string;
  chars: number;
  truncated: boolean;
  truncationReason?: PersonaContextTruncationReason;
}

export interface PersonaContextManifest {
  schemaVersion: 1;
  personaId: string;
  personaRoot: string;
  specialistId?: string;
  specialistRoot?: string;
  limits: {
    maxFileChars: number;
    maxTotalChars: number;
  };
  totals: {
    requestedFiles: number;
    loadedFiles: number;
    loadedChars: number;
    truncatedFiles: number;
  };
  entries: PersonaContextManifestEntry[];
}

export interface ReferencedFileSnapshot {
  sourcePath: string;
  importSpecifier: string;
  path: string;
  chars: number;
  truncated: boolean;
  contentFormat?: "full" | "symbolic-signatures";
  content: string;
}

export interface ReferencedFileSnapshotMeta {
  attemptedImports: number;
  loadedSnapshots: number;
  limitHit: boolean;
  maxReferencedFiles: number;
  maxReferencedFileChars: number;
}

export interface PersonaEvidenceManifestEntry {
  id: string;
  label: string;
  sha256: string;
  artifactPath: string;
  type: "text" | "json" | "binary";
  sizeBytes: number;
  createdAt: string;
}

export interface PersonaRunResult {
  schemaVersion: number;
  runId: string;
  personaName: string;
  specialistName?: string;
  sessionId: string;
  repoPath: string;
  headRef: string;
  baseRef: string;
  baseRefResolvedFrom: "flag" | "main" | "origin-head";
  status: "ok" | "failed";
  startedAt: string;
  finishedAt: string;
  artifacts: {
    auditDir: string;
    resultJsonPath: string;
    reportMarkdownPath: string;
    outJsonPath?: string;
    outMarkdownPath?: string;
  };
  contextManifest: PersonaContextManifest;
  referencedFileMeta: ReferencedFileSnapshotMeta;
  referencedFileSnapshots: ReferencedFileSnapshot[];
  evidenceManifest: PersonaEvidenceManifestEntry[];
  dependencyInspection: DependencyInspection;
  findings: ReviewFinding[];
  mergeGate: "pass" | "fail";
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  contextMeta?: unknown;
  reportMarkdown: string;
  modelOutputRaw: string;
  modelOutputParsed: boolean;
  parseRetryAttempted: boolean;
  parseError?: string;
  runtimeResult?: {
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
  };
  error?: {
    message: string;
  };
}

export interface PersonaModelOutputV1 {
  schemaVersion: 1;
  mergeGate: "pass" | "fail";
  reportMarkdown: string;
  findings: ReviewFinding[];
  dependencyInspection?: {
    status: "ok" | "skipped";
    notes?: string[];
  };
}

export type SpecialistOutputStdout = PersonaOutputStdout;
export type SpecialistCuratedContextDefinition = PersonaCuratedContextDefinition;
export type SpecialistSkillDefinition = PersonaSkillDefinition;
export type SpecialistDefinition = PersonaDefinition;
export type SpecialistContextSectionKind = PersonaContextSectionKind;
export type SpecialistContextTruncationReason = PersonaContextTruncationReason;
export type SpecialistContextManifestEntry = PersonaContextManifestEntry;
export type SpecialistContextManifest = PersonaContextManifest;
export type SpecialistEvidenceManifestEntry = PersonaEvidenceManifestEntry;
export type SpecialistRunResult = PersonaRunResult;
export type SpecialistModelOutputV1 = PersonaModelOutputV1;
