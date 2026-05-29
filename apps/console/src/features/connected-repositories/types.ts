export type ConnectedRepositorySourceType = "existing-path" | "managed-clone";
export type ConnectedRepositoryStatus = "ready" | "missing" | "invalid" | "auth-required" | "error";
export type ConnectedRepositoryDirtyState = "clean" | "dirty" | "unknown";

export type ConnectedRepository = {
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
};

export type ConnectedRepositoryListResult = {
  repositories: ConnectedRepository[];
  total: number;
};

export type ConnectedRepositoryCreateRequest = {
  id?: string;
  name: string;
  sourceType: ConnectedRepositorySourceType;
  workspacePath?: string;
  hostPath?: string;
  remoteUrl?: string;
  defaultBranch?: string;
};

export type ConnectedRepositoryInspection = {
  repository?: ConnectedRepository;
  path: string;
  status: ConnectedRepositoryStatus;
  dirtyState: ConnectedRepositoryDirtyState;
  statusMessage?: string;
  currentBranch?: string;
  headCommit?: string;
  remoteUrl?: string;
  inspectedAt: string;
};
