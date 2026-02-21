import type { SpecialistRunRequest } from "../../specialists/run.js";
import { AthenaError } from "../../runtime/errors.js";
import { optionalString, requireString } from "../validation.js";

export function parseSpecialistRunRequest(body: Record<string, unknown>): SpecialistRunRequest {
  const stdout = optionalString(body, "stdout", "specialists.run");
  if (stdout && !["summary", "json", "md", "none"].includes(stdout)) {
    throw new AthenaError("CONFIG_ERROR", "specialists.run.stdout must be summary|json|md|none.");
  }
  const baseRef = optionalString(body, "baseRef", "specialists.run");
  const sessionId = optionalString(body, "sessionId", "specialists.run");
  const provider = optionalString(body, "provider", "specialists.run");
  const model = optionalString(body, "model", "specialists.run");
  const outJsonPath = optionalString(body, "outJsonPath", "specialists.run");
  const outMarkdownPath = optionalString(body, "outMarkdownPath", "specialists.run");

  return {
    name: requireString(body, "name", "specialists.run"),
    repoPath: requireString(body, "repoPath", "specialists.run"),
    headRef: requireString(body, "headRef", "specialists.run"),
    ...(baseRef ? { baseRef } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(outJsonPath ? { outJsonPath } : {}),
    ...(outMarkdownPath ? { outMarkdownPath } : {}),
    ...(stdout ? { stdout: stdout as "summary" | "json" | "md" | "none" } : {})
  };
}

export const parsePersonaRunRequest = parseSpecialistRunRequest;
