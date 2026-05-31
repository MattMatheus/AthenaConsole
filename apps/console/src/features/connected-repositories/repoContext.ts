import type { ConnectedRepository } from "./types";

export type ConnectedRepositoryContext = {
  id: string;
  name: string;
  sourceType: ConnectedRepository["sourceType"];
  path: string;
  workspacePath: string;
  status: ConnectedRepository["status"];
  dirtyState: ConnectedRepository["dirtyState"];
  hostPath?: string;
  remoteUrl?: string;
  currentBranch?: string;
  headCommit?: string;
};

export function buildConnectedRepositoryContext(repository: ConnectedRepository): ConnectedRepositoryContext {
  return {
    id: repository.id,
    name: repository.name,
    sourceType: repository.sourceType,
    path: repository.workspacePath,
    workspacePath: repository.workspacePath,
    status: repository.status,
    dirtyState: repository.dirtyState,
    ...(repository.hostPath ? { hostPath: repository.hostPath } : {}),
    ...(repository.remoteUrl ? { remoteUrl: repository.remoteUrl } : {}),
    ...(repository.currentBranch ? { currentBranch: repository.currentBranch } : {}),
    ...(repository.headCommit ? { headCommit: repository.headCommit } : {}),
  };
}

export function mergeConnectedRepositoryContext(
  inputs: Record<string, unknown>,
  repository: ConnectedRepository | undefined,
): Record<string, unknown> {
  if (!repository) {
    return inputs;
  }
  return {
    ...inputs,
    repo: buildConnectedRepositoryContext(repository),
    ...(inputs.repoPath === undefined ? { repoPath: repository.workspacePath } : {}),
  };
}

export function connectedRepositoryReadinessMessage(repository: ConnectedRepository | undefined): string | undefined {
  if (!repository) {
    return undefined;
  }
  if (repository.status === "ready") {
    return undefined;
  }
  return `Selected repository is ${repository.status}. Inspect or fix it before starting ready work.`;
}
