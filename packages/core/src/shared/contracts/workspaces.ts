import type { AthenaRbacRole } from "./base.js";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceListResult {
  workspaces: Workspace[];
  total: number;
}

export interface WorkspaceCreateRequest {
  id?: string;
  name: string;
  slug?: string;
}

export interface WorkspaceUpdateRequest {
  name?: string;
  slug?: string;
}

export interface WorkspaceDeleteResult {
  id: string;
  deleted: boolean;
}

export interface WorkspaceMember {
  workspaceId: string;
  subject: string;
  role: AthenaRbacRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberListResult {
  members: WorkspaceMember[];
  total: number;
}

export interface WorkspaceMemberUpsertRequest {
  role: AthenaRbacRole;
}

export interface WorkspaceMemberDeleteResult {
  workspaceId: string;
  subject: string;
  deleted: boolean;
}
