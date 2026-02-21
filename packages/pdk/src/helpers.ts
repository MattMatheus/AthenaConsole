import type { FindingPriority } from "./contracts.js";

export const PERSONA_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

export function isValidPersonaName(name: string): boolean {
  return PERSONA_NAME_PATTERN.test(name);
}

export function assertValidPersonaName(name: string): void {
  if (!isValidPersonaName(name)) {
    throw new Error(`Invalid persona id '${name}'. Allowed pattern: ${PERSONA_NAME_PATTERN.source}`);
  }
}

export function isFindingPriority(value: unknown): value is FindingPriority {
  return value === "P1" || value === "P2" || value === "P3";
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
