import { isAbsolute, relative, resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";

export function resolvePathWithinRoot(root: string, childPath: string, contextLabel: string): string {
  const candidate = resolve(root, childPath);
  const rel = relative(root, candidate);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new AthenaError("SESSION_IO_ERROR", `Resolved path escapes ${contextLabel}: ${candidate}`);
  }
  return candidate;
}

export function resolveJsonPathWithinRoot(root: string, id: string, contextLabel: string): string {
  return resolvePathWithinRoot(root, `${id}.json`, contextLabel);
}
