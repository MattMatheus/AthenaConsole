import { AthenaError } from "../../runtime/errors.js";
import type { WorkspaceCreateRequest, WorkspaceMemberUpsertRequest, WorkspaceUpdateRequest } from "../../shared/contracts.js";
import type { AthenaRbacRole } from "../../shared/contracts/base.js";
import { optionalString, parseJsonObject, requireString } from "../validation.js";

export function parseWorkspaceCreateRequest(body: unknown): WorkspaceCreateRequest {
  const row = parseJsonObject(body, "workspaces.create");
  const id = optionalString(row, "id", "workspaces.create");
  const slug = optionalString(row, "slug", "workspaces.create");
  return {
    ...(id ? { id: normalizeIdentifier(id, "workspaces.create.id") } : {}),
    name: requireString(row, "name", "workspaces.create"),
    ...(slug ? { slug: normalizeSlug(slug, "workspaces.create.slug") } : {})
  };
}

export function parseWorkspaceUpdateRequest(body: unknown): WorkspaceUpdateRequest {
  const row = parseJsonObject(body, "workspaces.update");
  const name = optionalString(row, "name", "workspaces.update");
  const slug = optionalString(row, "slug", "workspaces.update");
  return {
    ...(name ? { name } : {}),
    ...(slug ? { slug: normalizeSlug(slug, "workspaces.update.slug") } : {})
  };
}

export function parseWorkspaceMemberUpsertRequest(body: unknown): WorkspaceMemberUpsertRequest {
  const row = parseJsonObject(body, "workspaces.members.upsert");
  return {
    role: requireWorkspaceRole(requireString(row, "role", "workspaces.members.upsert"))
  };
}

function requireWorkspaceRole(value: string): AthenaRbacRole {
  if (value === "Viewer" || value === "Operator" || value === "Admin") {
    return value;
  }
  throw new AthenaError("CONFIG_ERROR", "workspaces.members.upsert.role must be Viewer, Operator, or Admin.");
}

function normalizeIdentifier(value: string, context: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(value)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `${context} must be 2-64 characters using letters, numbers, hyphen, or underscore.`
    );
  }
  return value;
}

function normalizeSlug(value: string, context: string): string {
  const normalized = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(normalized)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `${context} must be 2-64 lowercase letters, numbers, or hyphen characters.`
    );
  }
  return normalized;
}
