import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli/index.js";
import { scaffoldAgentPlugin } from "../src/control-plane/agent-scaffold.js";
import { validatePluginPackage } from "../src/control-plane/manifests/index.js";

describe("agent scaffold", () => {
  it("creates a plugin-backed local agent through the CLI", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-scaffold-cli-"));
    try {
      const out = await runCli(["agent", "scaffold", "--name", "Research Helper"], { cwd: dir });
      const parsed = JSON.parse(out) as {
        status: string;
        action: string;
        pluginId: string;
        agentId: string;
        pluginRoot: string;
        validation: { ok: boolean; issueCount: number };
        files: string[];
      };

      expect(parsed.status).toBe("ok");
      expect(parsed.action).toBe("agent.scaffold");
      expect(parsed.pluginId).toBe("local.research-helper");
      expect(parsed.agentId).toBe("local.research-helper.agent");
      expect(parsed.pluginRoot).toBe(".athena/plugins/research-helper");
      expect(parsed.validation).toEqual({ ok: true, issueCount: 0 });
      expect(parsed.files).toEqual([
        ".athena/plugins/research-helper/plugin.yaml",
        ".athena/plugins/research-helper/agents/scaffold.agent.yaml",
        ".athena/plugins/research-helper/agents/scaffold-runner.mjs",
        ".athena/plugins/research-helper/docs/README.md"
      ]);

      const pluginRoot = join(dir, parsed.pluginRoot);
      expect(validatePluginPackage(pluginRoot)).toEqual({ ok: true, issues: [] });
      expect(existsSync(join(pluginRoot, "plugin.yaml"))).toBe(true);
      expect(existsSync(join(pluginRoot, "agents", "scaffold.agent.yaml"))).toBe(true);
      expect(existsSync(join(pluginRoot, "agents", "scaffold-runner.mjs"))).toBe(true);
      expect(existsSync(join(pluginRoot, "docs", "README.md"))).toBe(true);

      const readme = readFileSync(join(pluginRoot, "docs", "README.md"), "utf8");
      expect(readme).toContain("Restart the API");
      expect(readme).toContain("console Agents page");
      expect(readme).toContain("Open Tasks");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("derives unique ids and directories when scaffolded names repeat", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-scaffold-repeat-"));
    try {
      const first = await scaffoldAgentPlugin({ workspaceRoot: dir, name: "Research Helper" });
      const second = await scaffoldAgentPlugin({ workspaceRoot: dir, name: "Research Helper" });

      expect(first.pluginId).toBe("local.research-helper");
      expect(first.agentId).toBe("local.research-helper.agent");
      expect(second.pluginId).toBe("local.research-helper-2");
      expect(second.agentId).toBe("local.research-helper-2.agent");
      expect(second.pluginRoot.endsWith(".athena/plugins/research-helper-2")).toBe(true);
      expect(validatePluginPackage(second.pluginRoot)).toEqual({ ok: true, issues: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects explicit duplicate plugin and agent ids", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-agent-scaffold-duplicates-"));
    try {
      await scaffoldAgentPlugin({
        workspaceRoot: dir,
        name: "Research Helper",
        pluginId: "local.research-helper",
        agentId: "local.research-helper.agent"
      });

      await expect(
        scaffoldAgentPlugin({
          workspaceRoot: dir,
          name: "Another Helper",
          pluginId: "local.research-helper"
        })
      ).rejects.toThrow("Duplicate plugin id");

      await expect(
        scaffoldAgentPlugin({
          workspaceRoot: dir,
          name: "Another Helper",
          pluginId: "local.another-helper",
          agentId: "local.research-helper.agent"
        })
      ).rejects.toThrow("Duplicate agent id");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
