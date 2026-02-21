import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { acquireSessionLock } from "../runtime/session-lock.js";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import type { AthenaRbacRole, IdentityRoleAssignment, IdentitySubjectType } from "../shared/contracts.js";

interface IdentityAssignmentStateFile {
  schemaVersion: 1;
  assignments: IdentityRoleAssignment[];
}

const DEFAULT_STATE: IdentityAssignmentStateFile = {
  schemaVersion: 1,
  assignments: []
};

const VALID_ROLES = new Set<AthenaRbacRole>(["Viewer", "Operator", "Admin"]);
const VALID_SUBJECT_TYPES = new Set<IdentitySubjectType>(["identity", "service-token"]);

export class IdentityAssignmentStore {
  private readonly rbacDir: string;
  private readonly statePath: string;
  private readonly lockPath: string;
  private syncCache:
    | {
        mtimeMs: number;
        size: number;
        assignments: IdentityRoleAssignment[];
      }
    | undefined;

  constructor(config: AthenaConfig) {
    this.rbacDir = resolve(config.workspaceRoot, config.stateDir, "rbac");
    this.statePath = resolve(this.rbacDir, "assignments.json");
    this.lockPath = resolve(this.rbacDir, "assignments.lock");
  }

  resolveSync(subject: string): IdentityRoleAssignment | undefined {
    const normalized = normalizeSubject(subject);
    if (!normalized) {
      return undefined;
    }
    const assignments = this.loadAssignmentsSync();
    return assignments.find((assignment) => assignment.subject === normalized);
  }

  async list(): Promise<IdentityRoleAssignment[]> {
    const state = await this.loadState();
    return [...state.assignments];
  }

  async upsert(input: {
    subject: string;
    subjectType: IdentitySubjectType;
    role: AthenaRbacRole;
    updatedBy?: string;
  }): Promise<{ assignment: IdentityRoleAssignment; previous?: IdentityRoleAssignment }> {
    const subject = requireSubject(input.subject, "rbac.assignments.upsert.subject");
    const subjectType = requireSubjectType(input.subjectType, "rbac.assignments.upsert.subjectType");
    const role = requireRole(input.role, "rbac.assignments.upsert.role");
    const updatedBy = input.updatedBy?.trim();

    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const state = await this.loadState();
      const existingIndex = state.assignments.findIndex((assignment) => assignment.subject === subject);
      const previous = existingIndex >= 0 ? state.assignments[existingIndex] : undefined;
      const now = new Date().toISOString();
      const assignment: IdentityRoleAssignment = {
        subject,
        subjectType,
        role,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        ...(updatedBy ? { updatedBy } : {})
      };
      if (existingIndex >= 0) {
        state.assignments.splice(existingIndex, 1, assignment);
      } else {
        state.assignments.push(assignment);
      }
      sortAssignments(state.assignments);
      await this.saveState(state);
      this.syncCache = undefined;
      return {
        assignment,
        ...(previous ? { previous } : {})
      };
    } finally {
      await lock.release();
    }
  }

  async remove(subject: string): Promise<{ removed: boolean; previous?: IdentityRoleAssignment }> {
    const normalized = requireSubject(subject, "rbac.assignments.delete.subject");
    const lock = await acquireSessionLock(this.lockPath, {
      timeoutMs: 5_000,
      retryDelayMs: 20
    });
    try {
      const state = await this.loadState();
      const existingIndex = state.assignments.findIndex((assignment) => assignment.subject === normalized);
      if (existingIndex < 0) {
        return { removed: false };
      }
      const [previous] = state.assignments.splice(existingIndex, 1);
      await this.saveState(state);
      this.syncCache = undefined;
      return {
        removed: true,
        ...(previous ? { previous } : {})
      };
    } finally {
      await lock.release();
    }
  }

  private loadAssignmentsSync(): IdentityRoleAssignment[] {
    if (!existsSync(this.statePath)) {
      this.syncCache = {
        mtimeMs: -1,
        size: 0,
        assignments: []
      };
      return [];
    }
    try {
      const stats = statSync(this.statePath);
      if (this.syncCache && this.syncCache.mtimeMs === stats.mtimeMs && this.syncCache.size === stats.size) {
        return this.syncCache.assignments;
      }
      const raw = readFileSync(this.statePath, "utf8");
      const parsed = normalizeState(JSON.parse(raw));
      const assignments = parsed.assignments;
      this.syncCache = {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        assignments
      };
      return assignments;
    } catch {
      return [];
    }
  }

  private async loadState(): Promise<IdentityAssignmentStateFile> {
    await mkdir(this.rbacDir, { recursive: true });
    if (!existsSync(this.statePath)) {
      return {
        schemaVersion: 1,
        assignments: []
      };
    }
    const raw = await readFile(this.statePath, "utf8");
    return normalizeState(JSON.parse(raw) as unknown);
  }

  private async saveState(state: IdentityAssignmentStateFile): Promise<void> {
    await mkdir(this.rbacDir, { recursive: true });
    const tmp = `${this.statePath}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tmp, this.statePath);
    await rm(tmp, { force: true });
  }
}

function normalizeState(value: unknown): IdentityAssignmentStateFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_STATE };
  }
  const parsed = value as { assignments?: unknown };
  const assignments = Array.isArray(parsed.assignments)
    ? parsed.assignments
        .map(normalizeAssignment)
        .filter((assignment): assignment is IdentityRoleAssignment => assignment !== undefined)
    : [];
  sortAssignments(assignments);
  return {
    schemaVersion: 1,
    assignments
  };
}

function normalizeAssignment(value: unknown): IdentityRoleAssignment | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const subject = normalizeSubject(row.subject);
  const role = typeof row.role === "string" && VALID_ROLES.has(row.role as AthenaRbacRole) ? (row.role as AthenaRbacRole) : undefined;
  const subjectType =
    typeof row.subjectType === "string" && VALID_SUBJECT_TYPES.has(row.subjectType as IdentitySubjectType)
      ? (row.subjectType as IdentitySubjectType)
      : "identity";
  const createdAt = toIso(row.createdAt) ?? new Date().toISOString();
  const updatedAt = toIso(row.updatedAt) ?? createdAt;
  const updatedBy = typeof row.updatedBy === "string" && row.updatedBy.trim().length > 0 ? row.updatedBy.trim() : undefined;
  if (!subject || !role) {
    return undefined;
  }
  return {
    subject,
    subjectType,
    role,
    createdAt,
    updatedAt,
    ...(updatedBy ? { updatedBy } : {})
  };
}

function toIso(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return Number.isNaN(Date.parse(trimmed)) ? undefined : trimmed;
}

function normalizeSubject(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireSubject(value: string, context: string): string {
  const subject = normalizeSubject(value);
  if (!subject) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a non-empty string.`);
  }
  return subject;
}

function requireRole(value: AthenaRbacRole, context: string): AthenaRbacRole {
  if (!VALID_ROLES.has(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be Viewer|Operator|Admin.`);
  }
  return value;
}

function requireSubjectType(value: IdentitySubjectType, context: string): IdentitySubjectType {
  if (!VALID_SUBJECT_TYPES.has(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be identity|service-token.`);
  }
  return value;
}

function sortAssignments(assignments: IdentityRoleAssignment[]): void {
  assignments.sort((left, right) => left.subject.localeCompare(right.subject));
}
