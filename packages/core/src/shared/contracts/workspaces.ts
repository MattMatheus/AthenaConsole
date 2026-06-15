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
