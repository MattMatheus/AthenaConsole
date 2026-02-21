export type PersonaOutputStdout = "summary" | "json" | "md" | "none";

export type FindingPriority = "P1" | "P2" | "P3";

export interface ReviewFinding {
  priority: FindingPriority;
  confidence: number;
  title: string;
  message: string;
  suggestion?: string;
  file?: string;
  line?: number;
}

export interface ContextReference {
  kind: "prompt" | "skill" | "doc";
  path: string;
  required?: boolean;
  description?: string;
}

export interface Context {
  promptFiles?: string[];
  skillFiles?: string[];
  docFiles?: string[];
  refs?: ContextReference[];
  maxFileChars?: number;
  maxTotalChars?: number;
}

export interface Skill {
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
  context?: Context;
  skills?: Skill[];
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

export interface PersonaRunInput {
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

export interface DependencyInspection {
  status: "ok" | "skipped";
  detectedEcosystem?: string;
  notes?: string[];
  addedImports?: string[];
  changedManifests?: string[];
}

export interface PersonaRunOutput {
  schemaVersion: number;
  runId: string;
  personaName: string;
  sessionId: string;
  repoPath: string;
  headRef: string;
  baseRef: string;
  status: "ok" | "failed";
  startedAt: string;
  finishedAt: string;
  findings: ReviewFinding[];
  mergeGate: "pass" | "fail";
  dependencyInspection: DependencyInspection;
  reportMarkdown: string;
  modelOutputRaw: string;
  modelOutputParsed: boolean;
  parseRetryAttempted: boolean;
  parseError?: string;
  error?: {
    message: string;
  };
}
