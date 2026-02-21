import { AthenaError } from "../runtime/errors.js";

function requireObject(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function parseJsonObject(value: unknown, context: string): Record<string, unknown> {
  return requireObject(value, context);
}

export function requireString(body: Record<string, unknown>, key: string, context: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a non-empty string.`);
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, key: string, context: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a string when provided.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function optionalBoolean(body: Record<string, unknown>, key: string, context: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a boolean when provided.`);
  }
  return value;
}

export function requirePositiveInt(body: Record<string, unknown>, key: string, context: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a positive integer.`);
  }
  return value;
}

export function optionalPositiveInt(body: Record<string, unknown>, key: string, context: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a positive integer when provided.`);
  }
  return value;
}

export function optionalNumber(body: Record<string, unknown>, key: string, context: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be a finite number when provided.`);
  }
  return value;
}

export function requireMode(body: Record<string, unknown>, key: string, context: string): "followup" | "collect" {
  const value = body[key];
  if (value !== "followup" && value !== "collect") {
    throw new AthenaError("CONFIG_ERROR", `${context}.${key} must be 'followup' or 'collect'.`);
  }
  return value;
}
