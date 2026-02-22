import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { AthenaError } from "../runtime/errors.js";
import type {
  PersonaContextManifest,
  PersonaContextManifestEntry,
  PersonaContextSectionKind,
  PersonaContextTruncationReason,
  PersonaDefinition
} from "./types.js";
import { resolvePersonaContentRoot } from "./loader.js";

const DEFAULT_MAX_FILE_CHARS = 20_000;
const DEFAULT_MAX_TOTAL_CHARS = 120_000;

interface CuratedFileSection {
  kind: PersonaContextSectionKind;
  path: string;
  content: string;
}

export interface PersonaContextPack {
  systemContent: string;
  userContent: string;
  manifest: PersonaContextManifest;
}

function assertPathWithin(baseDir: string, candidate: string): void {
  const rel = relative(baseDir, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new AthenaError("CONFIG_ERROR", `Persona context path escapes '${baseDir}': ${candidate}`);
  }
}

function validateContextPath(rawPath: string): void {
  if (!rawPath || typeof rawPath !== "string") {
    throw new AthenaError("CONFIG_ERROR", "Persona context file paths must be non-empty strings.");
  }
  if (isAbsolute(rawPath)) {
    throw new AthenaError("CONFIG_ERROR", `Persona context file path must be relative: ${rawPath}`);
  }
}

function buildSectionTitle(kind: PersonaContextSectionKind, path: string): string {
  if (kind === "prompt") {
    return `Prompt File: ${path}`;
  }
  if (kind === "skill") {
    return `Skill File: ${path}`;
  }
  return `Doc File: ${path}`;
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

async function loadCuratedFiles(options: {
  workspaceRoot: string;
  persona: PersonaDefinition;
  maxFileChars: number;
  maxTotalChars: number;
}): Promise<{ sections: CuratedFileSection[]; manifestEntries: PersonaContextManifestEntry[]; loadedChars: number }> {
  const personaRoot = resolvePersonaContentRoot(options.workspaceRoot, options.persona.id);
  const promptFiles = options.persona.context?.promptFiles ?? [];
  const skillFiles = options.persona.context?.skillFiles ?? [];
  const docFiles = options.persona.context?.docFiles ?? [];
  const workspaceDocFiles = options.persona.context?.workspaceDocFiles ?? [];

  const ordered: Array<{ kind: PersonaContextSectionKind; path: string; baseDir: string; displayPath: string }> = [
    ...promptFiles.map((path) => ({ kind: "prompt" as const, path, baseDir: personaRoot, displayPath: path })),
    ...skillFiles.map((path) => ({ kind: "skill" as const, path, baseDir: personaRoot, displayPath: path })),
    ...docFiles.map((path) => ({ kind: "doc" as const, path, baseDir: personaRoot, displayPath: path })),
    ...workspaceDocFiles.map((path) => ({
      kind: "doc" as const,
      path,
      baseDir: options.workspaceRoot,
      displayPath: `workspace:${path}`
    }))
  ];

  const sections: CuratedFileSection[] = [];
  const manifestEntries: PersonaContextManifestEntry[] = [];
  let loadedChars = 0;

  for (const item of ordered) {
    validateContextPath(item.path);
    const absPath = resolve(item.baseDir, item.path);
    assertPathWithin(item.baseDir, absPath);

    let raw: string;
    try {
      raw = await readFile(absPath, "utf8");
    } catch (error) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `Persona context file missing or unreadable: ${item.displayPath} (${absPath})`,
        false,
        error
      );
    }

    const fileCapped = withFileTruncation(raw, options.maxFileChars, item.displayPath);
    const totalCapped = withTotalBudgetTruncation(fileCapped.text, options.maxTotalChars, loadedChars, item.displayPath);
    const text = totalCapped.text;
    loadedChars += text.length;

    let truncationReason: PersonaContextTruncationReason | undefined;
    if (totalCapped.truncated) {
      truncationReason = "max-total-chars";
    } else if (fileCapped.truncated) {
      truncationReason = "max-file-chars";
    }

    manifestEntries.push({
      kind: item.kind,
      path: item.displayPath,
      chars: text.length,
      truncated: Boolean(truncationReason),
      ...(truncationReason ? { truncationReason } : {})
    });
    sections.push({
      kind: item.kind,
      path: item.displayPath,
      content: text
    });
  }

  return { sections, manifestEntries, loadedChars };
}

function renderSection(kind: PersonaContextSectionKind, path: string, content: string): string {
  return [`### ${buildSectionTitle(kind, path)}`, content].join("\n");
}

export async function assemblePersonaContextPack(options: {
  workspaceRoot: string;
  persona: PersonaDefinition;
}): Promise<PersonaContextPack> {
  const maxFileChars = options.persona.context?.maxFileChars ?? DEFAULT_MAX_FILE_CHARS;
  const maxTotalChars = options.persona.context?.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;

  if (!Number.isInteger(maxFileChars) || maxFileChars <= 0) {
    throw new AthenaError("CONFIG_ERROR", `persona.context.maxFileChars must be a positive integer (got ${maxFileChars}).`);
  }
  if (!Number.isInteger(maxTotalChars) || maxTotalChars <= 0) {
    throw new AthenaError("CONFIG_ERROR", `persona.context.maxTotalChars must be a positive integer (got ${maxTotalChars}).`);
  }

  const loaded = await loadCuratedFiles({
    workspaceRoot: options.workspaceRoot,
    persona: options.persona,
    maxFileChars,
    maxTotalChars
  });

  const systemContent = loaded.sections
    .filter((section) => section.kind === "prompt" || section.kind === "skill")
    .map((section) => renderSection(section.kind, section.path, section.content))
    .join("\n\n");
  const userContent = loaded.sections
    .filter((section) => section.kind === "doc")
    .map((section) => renderSection(section.kind, section.path, section.content))
    .join("\n\n");

  const personaRoot = resolvePersonaContentRoot(options.workspaceRoot, options.persona.id);
  const truncatedFiles = loaded.manifestEntries.filter((entry) => entry.truncated).length;
  const manifest: PersonaContextManifest = {
    schemaVersion: 1,
    personaId: options.persona.id,
    personaRoot,
    specialistId: options.persona.id,
    specialistRoot: personaRoot,
    limits: {
      maxFileChars,
      maxTotalChars
    },
    totals: {
      requestedFiles: loaded.manifestEntries.length,
      loadedFiles: loaded.manifestEntries.length,
      loadedChars: loaded.loadedChars,
      truncatedFiles
    },
    entries: loaded.manifestEntries
  };

  return {
    systemContent,
    userContent,
    manifest
  };
}
