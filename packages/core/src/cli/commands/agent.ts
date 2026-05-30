import { loadConfig } from "../../shared/config.js";
import { scaffoldAgentPlugin, relativeToWorkspace } from "../../control-plane/agent-scaffold.js";
import { parseArgs } from "../helpers/args.js";
import { usage } from "../helpers/usage.js";
import type { CliOptions } from "../types.js";

export async function runAgentCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  if (action !== "scaffold") {
    throw new Error(`Unknown agent action '${action}'.\n${usage()}`);
  }

  const parsed = parseArgs(["agent", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const name = parsed.flags.name ?? argv[1];
  if (!name || name === "scaffold") {
    throw new Error(`'agent scaffold' requires --name <display-name>.\n${usage()}`);
  }

  const result = await scaffoldAgentPlugin({
    workspaceRoot: config.workspaceRoot,
    name,
    ...(parsed.flags["plugins-dir"] ? { pluginsDir: parsed.flags["plugins-dir"] } : {}),
    ...(parsed.flags["plugin-id"] ? { pluginId: parsed.flags["plugin-id"] } : {}),
    ...(parsed.flags["agent-id"] ? { agentId: parsed.flags["agent-id"] } : {}),
    ...(parsed.flags.description ? { description: parsed.flags.description } : {})
  });

  return JSON.stringify(
    {
      ...result,
      pluginRoot: relativeToWorkspace(config.workspaceRoot, result.pluginRoot),
      files: result.files.map((path) => relativeToWorkspace(config.workspaceRoot, path))
    },
    null,
    2
  );
}
