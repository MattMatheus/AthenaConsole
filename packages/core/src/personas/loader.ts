import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AthenaError } from "../runtime/errors.js";
import type { PersonaDefinition } from "./types.js";

const PERSONA_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const SPECIALISTS_DIR = "specialists";
const LEGACY_PERSONAS_DIR = "personas";

function resolveSpecialistsDirectoryCandidates(workspaceRoot: string): string[] {
  return [
    resolve(workspaceRoot, SPECIALISTS_DIR),
    resolve(workspaceRoot, "..", SPECIALISTS_DIR),
    resolve(workspaceRoot, "..", "..", SPECIALISTS_DIR)
  ];
}

function looksLikeCorePackageWorkspace(workspaceRoot: string): boolean {
  return existsSync(resolve(workspaceRoot, "src", "personas")) && existsSync(resolve(workspaceRoot, "package.json"));
}

export function resolveSpecialistsDirectory(workspaceRoot: string): string {
  for (const candidate of resolveSpecialistsDirectoryCandidates(workspaceRoot)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (looksLikeCorePackageWorkspace(workspaceRoot)) {
    return resolve(workspaceRoot, "..", "..", SPECIALISTS_DIR);
  }
  return resolve(workspaceRoot, SPECIALISTS_DIR);
}

export function assertValidPersonaName(name: string): void {
  if (!PERSONA_NAME_PATTERN.test(name)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `Invalid persona name '${name}'. Allowed pattern: ${PERSONA_NAME_PATTERN.source}`
    );
  }
}

export function resolvePersonaDefinitionPath(workspaceRoot: string, name: string): string {
  const specialistManifestPath = resolve(resolveSpecialistsDirectory(workspaceRoot), name, "manifest.json");
  if (existsSync(specialistManifestPath)) {
    return specialistManifestPath;
  }

  const legacyPath = resolve(workspaceRoot, LEGACY_PERSONAS_DIR, `${name}.json`);
  if (existsSync(legacyPath)) {
    return legacyPath;
  }
  return resolve(workspaceRoot, LEGACY_PERSONAS_DIR, name, "persona.json");
}

export function resolvePersonaContentRoot(workspaceRoot: string, name: string): string {
  const specialistRoot = resolve(resolveSpecialistsDirectory(workspaceRoot), name);
  if (existsSync(specialistRoot)) {
    return specialistRoot;
  }
  return resolve(workspaceRoot, LEGACY_PERSONAS_DIR, name);
}

export async function loadPersonaDefinition(workspaceRoot: string, name: string): Promise<PersonaDefinition> {
  assertValidPersonaName(name);
  const path = resolvePersonaDefinitionPath(workspaceRoot, name);
  if (!existsSync(path)) {
    const specialistManifestPath = resolve(resolveSpecialistsDirectory(workspaceRoot), name, "manifest.json");
    const legacyPath = resolve(workspaceRoot, LEGACY_PERSONAS_DIR, `${name}.json`);
    const nestedPath = resolve(workspaceRoot, LEGACY_PERSONAS_DIR, name, "persona.json");
    throw new AthenaError(
      "CONFIG_ERROR",
      `Persona definition not found. Checked: ${specialistManifestPath}, ${legacyPath}, ${nestedPath}`
    );
  }
  const raw = await readFile(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new AthenaError("CONFIG_ERROR", `Invalid JSON in persona definition: ${path}`, false, error);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new AthenaError("CONFIG_ERROR", `Invalid persona definition (expected object): ${path}`);
  }

  const def = parsed as PersonaDefinition;
  if (typeof def.schemaVersion !== "number" || def.schemaVersion <= 0) {
    throw new AthenaError("CONFIG_ERROR", `Persona definition missing schemaVersion: ${path}`);
  }
  if (!def.id || typeof def.id !== "string") {
    throw new AthenaError("CONFIG_ERROR", `Persona definition missing id: ${path}`);
  }
  if (def.id !== name) {
    throw new AthenaError("CONFIG_ERROR", `Persona id mismatch. Expected '${name}', got '${def.id}' (${path})`);
  }
  if (def.context !== undefined) {
    if (!def.context || typeof def.context !== "object") {
      throw new AthenaError("CONFIG_ERROR", `Persona context must be an object when provided: ${path}`);
    }

    const validatePathList = (field: "promptFiles" | "skillFiles" | "docFiles" | "workspaceDocFiles"): void => {
      const list = def.context?.[field];
      if (list === undefined) {
        return;
      }
      if (!Array.isArray(list)) {
        throw new AthenaError("CONFIG_ERROR", `Persona context.${field} must be an array: ${path}`);
      }
      for (const entry of list) {
        if (typeof entry !== "string" || entry.trim().length === 0) {
          throw new AthenaError("CONFIG_ERROR", `Persona context.${field} entries must be non-empty strings: ${path}`);
        }
      }
    };

    validatePathList("promptFiles");
    validatePathList("skillFiles");
    validatePathList("docFiles");
    validatePathList("workspaceDocFiles");

    if (def.context.maxFileChars !== undefined) {
      if (!Number.isInteger(def.context.maxFileChars) || def.context.maxFileChars <= 0) {
        throw new AthenaError("CONFIG_ERROR", `Persona context.maxFileChars must be a positive integer: ${path}`);
      }
    }
    if (def.context.maxTotalChars !== undefined) {
      if (!Number.isInteger(def.context.maxTotalChars) || def.context.maxTotalChars <= 0) {
        throw new AthenaError("CONFIG_ERROR", `Persona context.maxTotalChars must be a positive integer: ${path}`);
      }
    }
  }

  if (def.review?.maxReferencedFiles !== undefined) {
    if (!Number.isInteger(def.review.maxReferencedFiles) || def.review.maxReferencedFiles <= 0) {
      throw new AthenaError("CONFIG_ERROR", `Persona review.maxReferencedFiles must be a positive integer: ${path}`);
    }
  }
  if (def.review?.maxReferencedFileChars !== undefined) {
    if (!Number.isInteger(def.review.maxReferencedFileChars) || def.review.maxReferencedFileChars <= 0) {
      throw new AthenaError("CONFIG_ERROR", `Persona review.maxReferencedFileChars must be a positive integer: ${path}`);
    }
  }

  if (def.skills !== undefined) {
    if (!Array.isArray(def.skills)) {
      throw new AthenaError("CONFIG_ERROR", `Persona skills must be an array when provided: ${path}`);
    }
    for (const [index, skill] of def.skills.entries()) {
      if (!skill || typeof skill !== "object") {
        throw new AthenaError("CONFIG_ERROR", `Persona skills[${index}] must be an object: ${path}`);
      }
      if (typeof skill.id !== "string" || !skill.id.trim()) {
        throw new AthenaError("CONFIG_ERROR", `Persona skills[${index}].id must be a non-empty string: ${path}`);
      }
      if (skill.tags !== undefined) {
        if (!Array.isArray(skill.tags) || skill.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
          throw new AthenaError("CONFIG_ERROR", `Persona skills[${index}].tags must be an array of non-empty strings: ${path}`);
        }
      }
    }
  }

  return def;
}
