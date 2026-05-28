import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStateStoreDiagnostics } from "../src/control-plane/services/state-diagnostics.js";
import { FileStateStore } from "../src/control-plane/state-store.js";
import { loadConfig } from "../src/shared/config.js";

describe("state ownership diagnostics", () => {
  it("keeps file-backed runtime payloads explicitly classified", () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-state-ownership-"));
    try {
      const config = loadConfig(dir);
      const diagnostics = buildStateStoreDiagnostics(config, new FileStateStore(config));
      const categoriesById = new Map(diagnostics.stores.map((entry) => [entry.id, entry.category]));

      expect(Object.fromEntries(categoriesById)).toEqual({
        "sqlite-app-state": "sqlite-app-state",
        sessions: "intentional-file-support-state",
        transcripts: "intentional-file-artifact",
        "run-evidence": "intentional-file-artifact",
        "specialist-runs": "intentional-file-artifact",
        "persona-runs": "intentional-file-artifact",
        "work-queues": "intentional-file-support-state",
        directives: "sqlite-app-state",
        "harness-profiles": "sqlite-app-state",
        "run-templates": "sqlite-app-state",
        "legacy-workflows": "deprecated-file-backed-state",
        "legacy-workflow-runs": "deprecated-file-backed-state"
      });
      expect([...categoriesById.values()]).not.toContain("migration-candidate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
