import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import { AthenaError } from "../../runtime/errors.js";

export async function atomicWriteFile(path: string, payload: string): Promise<void> {
  const tmpPath = `${path}.${process.pid}.tmp`;
  await writeFile(tmpPath, payload, "utf8");
  await rename(tmpPath, path);
  await rm(tmpPath, { force: true });
}

export async function allocateUniqueId(
  resolvePath: (id: string) => string,
  errorMessage: string
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomUUID();
    if (!existsSync(resolvePath(id))) {
      return id;
    }
  }
  throw new AthenaError("SESSION_IO_ERROR", errorMessage);
}
