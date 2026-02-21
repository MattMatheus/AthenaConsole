import type { Context, PersonaDefinition } from "./contracts.js";
import { assertValidPersonaName } from "./helpers.js";

const CONTEXT_FIELDS = ["promptFiles", "skillFiles", "docFiles"] as const;

function assertPositiveInteger(value: unknown, field: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function assertStringArray(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== "string" || value[index].trim().length === 0) {
      throw new Error(`${field}[${index}] must be a non-empty string.`);
    }
  }
}

function assertContextReference(context: Context): void {
  if (context.refs === undefined) {
    return;
  }
  if (!Array.isArray(context.refs)) {
    throw new Error("context.refs must be an array when provided.");
  }

  for (let index = 0; index < context.refs.length; index += 1) {
    const reference = context.refs[index];
    if (!reference || typeof reference !== "object") {
      throw new Error(`context.refs[${index}] must be an object.`);
    }
    if (reference.kind !== "prompt" && reference.kind !== "skill" && reference.kind !== "doc") {
      throw new Error(`context.refs[${index}].kind must be prompt|skill|doc.`);
    }
    if (typeof reference.path !== "string" || reference.path.trim().length === 0) {
      throw new Error(`context.refs[${index}].path must be a non-empty string.`);
    }
  }
}

function assertContext(context: Context): void {
  for (const field of CONTEXT_FIELDS) {
    const value = context[field];
    if (value !== undefined) {
      assertStringArray(value, `context.${field}`);
    }
  }
  if (context.maxFileChars !== undefined) {
    assertPositiveInteger(context.maxFileChars, "context.maxFileChars");
  }
  if (context.maxTotalChars !== undefined) {
    assertPositiveInteger(context.maxTotalChars, "context.maxTotalChars");
  }
  assertContextReference(context);
}

function assertSkills(definition: PersonaDefinition): void {
  if (definition.skills === undefined) {
    return;
  }
  if (!Array.isArray(definition.skills)) {
    throw new Error("skills must be an array when provided.");
  }

  for (let index = 0; index < definition.skills.length; index += 1) {
    const skill = definition.skills[index];
    if (!skill || typeof skill !== "object") {
      throw new Error(`skills[${index}] must be an object.`);
    }
    if (typeof skill.id !== "string" || skill.id.trim().length === 0) {
      throw new Error(`skills[${index}].id must be a non-empty string.`);
    }
    if (skill.tags !== undefined) {
      assertStringArray(skill.tags, `skills[${index}].tags`);
    }
  }
}

export function definePersona(definition: PersonaDefinition): PersonaDefinition {
  if (!definition || typeof definition !== "object") {
    throw new Error("Persona definition must be an object.");
  }
  if (!Number.isInteger(definition.schemaVersion) || definition.schemaVersion <= 0) {
    throw new Error("schemaVersion must be a positive integer.");
  }
  if (typeof definition.id !== "string" || definition.id.trim().length === 0) {
    throw new Error("id must be a non-empty string.");
  }
  assertValidPersonaName(definition.id);

  if (definition.description !== undefined && typeof definition.description !== "string") {
    throw new Error("description must be a string when provided.");
  }

  if (definition.context !== undefined) {
    if (!definition.context || typeof definition.context !== "object") {
      throw new Error("context must be an object when provided.");
    }
    assertContext(definition.context);
  }

  if (definition.review?.maxReferencedFiles !== undefined) {
    assertPositiveInteger(definition.review.maxReferencedFiles, "review.maxReferencedFiles");
  }
  if (definition.review?.maxReferencedFileChars !== undefined) {
    assertPositiveInteger(definition.review.maxReferencedFileChars, "review.maxReferencedFileChars");
  }

  assertSkills(definition);

  return definition;
}
