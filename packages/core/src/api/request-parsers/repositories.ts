import { AthenaError } from "../../runtime/errors.js";
import type {
  ConnectedRepositoryCreateRequest,
  ConnectedRepositoryInspectPathRequest,
  ConnectedRepositorySourceType
} from "../../shared/contracts.js";
import { optionalString, requireString } from "../validation.js";

export function parseConnectedRepositoryCreateRequest(body: Record<string, unknown>): ConnectedRepositoryCreateRequest {
  const id = optionalString(body, "id", "repositories.create");
  const sourceType = parseSourceType(body.sourceType, "repositories.create.sourceType");
  const hostPath = optionalString(body, "hostPath", "repositories.create");
  const remoteUrl = optionalString(body, "remoteUrl", "repositories.create");
  const defaultBranch = optionalString(body, "defaultBranch", "repositories.create");
  return {
    ...(id ? { id } : {}),
    name: requireString(body, "name", "repositories.create"),
    sourceType,
    workspacePath: requireString(body, "workspacePath", "repositories.create"),
    ...(hostPath ? { hostPath } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(defaultBranch ? { defaultBranch } : {})
  };
}

export function parseConnectedRepositoryInspectPathRequest(
  body: Record<string, unknown>
): ConnectedRepositoryInspectPathRequest {
  return {
    workspacePath: requireString(body, "workspacePath", "repositories.inspect")
  };
}

function parseSourceType(value: unknown, context: string): ConnectedRepositorySourceType {
  if (typeof value !== "string") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a string.`);
  }
  const normalized = value.trim();
  if (normalized !== "existing-path" && normalized !== "managed-clone") {
    throw new AthenaError("CONFIG_ERROR", `${context} must be existing-path or managed-clone.`);
  }
  return normalized;
}
