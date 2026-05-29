export type ConnectedRepositorySourceType = "existing-path" | "managed-clone";
export type ConnectedRepositoryStatus = "ready" | "missing" | "invalid" | "auth-required" | "error";
export type ConnectedRepositoryDirtyState = "clean" | "dirty" | "unknown";

export interface ConnectedRepository {
  id: string;
  name: string;
  sourceType: ConnectedRepositorySourceType;
  workspacePath: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
  currentBranch?: string;
  headCommit?: string;
  dirtyState: ConnectedRepositoryDirtyState;
  status: ConnectedRepositoryStatus;
  statusMessage?: string;
  lastInspectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedRepositoryListResult {
  repositories: ConnectedRepository[];
  total: number;
}

export interface ConnectedRepositoryCreateRequest {
  id?: string;
  name: string;
  sourceType: ConnectedRepositorySourceType;
  workspacePath: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
}

export interface ConnectedRepositoryInspection {
  repository?: ConnectedRepository;
  path: string;
  status: ConnectedRepositoryStatus;
  dirtyState: ConnectedRepositoryDirtyState;
  statusMessage?: string;
  currentBranch?: string;
  headCommit?: string;
  remoteUrl?: string;
  inspectedAt: string;
}

export interface ConnectedRepositoryInspectPathRequest {
  workspacePath: string;
}

export interface ConnectedRepositoryDeleteResult {
  id: string;
  deleted: boolean;
}
