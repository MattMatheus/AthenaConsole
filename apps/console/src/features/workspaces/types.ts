export type Workspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceListResult = {
  workspaces: Workspace[];
  total: number;
};

export type WorkspaceCreateRequest = {
  id?: string;
  name: string;
  slug?: string;
};

export type WorkspaceUpdateRequest = {
  name?: string;
  slug?: string;
};

export type WorkspaceDeleteResult = {
  id: string;
  deleted: boolean;
};
