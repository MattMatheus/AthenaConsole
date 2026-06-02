import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveManifestSchemaRoot,
  validateManifestDocument,
  validatePluginPackage
} from "../src/control-plane/manifests/index.js";

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = resolve(coreRoot, "schemas", "team-orchestrator", "manifests", "v1", "examples");

describe("Team Orchestrator manifest schemas", () => {
  it("uses the canonical v1 schema location", () => {
    expect(resolveManifestSchemaRoot()).toBe(resolve(coreRoot, "schemas", "team-orchestrator", "manifests", "v1"));
  });

  it("validates all bundled plugin examples and their referenced agents", () => {
    const exampleNames = readdirSync(examplesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(exampleNames).toEqual(["local-command-agent", "multi-agent-plugin", "single-agent-plugin"]);
    for (const exampleName of exampleNames) {
      const result = validatePluginPackage(resolve(examplesRoot, exampleName));
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });

  it("rejects agent manifests without declared capabilities", () => {
    const result = validateManifestDocument("agent", {
      schemaVersion: 1,
      agent: {
        id: "invalid.agent",
        name: "Invalid Agent",
        version: "0.1.0",
        inputs: {
          task: {
            type: "string",
            required: true
          }
        },
        outputs: {
          mode: "flexible"
        },
        implementation: {
          type: "local-command",
          command: "node"
        },
        permissions: {
          network: "deny",
          filesystem: "none"
        },
        limits: {
          maxRuntimeSeconds: 60,
          maxToolCalls: 1
        },
        observability: {
          mode: "black-box"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("capabilities"))).toBe(true);
  });

  it("accepts omitted durable-memory permissions as default deny", () => {
    const result = validateManifestDocument("agent", buildAgentManifest());

    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts explicit durable-memory read, propose, and reviewed-write permissions", () => {
    const result = validateManifestDocument(
      "agent",
      buildAgentManifest({
        permissions: {
          network: "deny",
          filesystem: "none",
          durableMemory: {
            read: {
              namespaces: ["team.notes", "repo-summary/*"],
              maxSensitivity: "internal",
              reason: "Read curated team notes."
            },
            propose: {
              namespaces: ["repo-summary/*"],
              maxSensitivity: "sensitive",
              reason: "Create reviewed proposals from run outputs."
            },
            writeReviewed: {
              namespaces: ["operator-approved"],
              maxSensitivity: "internal",
              reason: "Write only after operator review."
            }
          }
        }
      })
    );

    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid durable-memory permission declarations", () => {
    const result = validateManifestDocument(
      "agent",
      buildAgentManifest({
        permissions: {
          network: "deny",
          filesystem: "none",
          durableMemory: {
            read: {
              namespaces: ["../secrets"],
              maxSensitivity: "private"
            }
          }
        }
      })
    );

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path.includes("durableMemory"))).toBe(true);
  });

  it("rejects workflow manifests with invalid task dependency DAGs", () => {
    const result = validateManifestDocument("workflow", {
      schemaVersion: 1,
      workflow: {
        id: "invalid.workflow",
        name: "Invalid Workflow",
        version: "0.1.0",
        goal: "Reject invalid dependencies.",
        tasks: [
          { id: "plan", title: "Plan", dependsOn: ["review"] },
          { id: "review", title: "Review", dependsOn: ["plan"] }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        path: "$.workflow.tasks",
        message: "Workflow task dependencies must not contain cycles: plan -> review -> plan."
      })
    ]);
  });

  it("rejects plugin agent references that escape the plugin root", () => {
    const dir = join(tmpdir(), `athena-manifest-escape-${Date.now()}`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "plugin.yaml"),
        [
          "schemaVersion: 1",
          "plugin:",
          "  id: invalid.plugin",
          "  name: Invalid Plugin",
          "  version: 0.1.0",
          "  agents:",
          "    - ../outside.agent.yaml",
          ""
        ].join("\n"),
        "utf8"
      );

      const result = validatePluginPackage(dir);

      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function buildAgentManifest(
  overrides: {
    permissions?: Record<string, unknown>;
  } = {}
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    agent: {
      id: "valid.agent",
      name: "Valid Agent",
      version: "0.1.0",
      capabilities: ["test.run"],
      inputs: {
        task: {
          type: "string",
          required: true
        }
      },
      outputs: {
        mode: "flexible"
      },
      implementation: {
        type: "local-command",
        command: "node"
      },
      permissions: overrides.permissions ?? {
        network: "deny",
        filesystem: "none"
      },
      limits: {
        maxRuntimeSeconds: 60,
        maxToolCalls: 1
      },
      observability: {
        mode: "black-box"
      }
    }
  };
}
