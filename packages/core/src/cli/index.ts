import { loadConfig } from "../shared/config.js";
import { runAgentCli } from "./commands/agent.js";
import { runApiCli } from "./commands/api.js";
import { runCancelCli } from "./commands/cancel.js";
import { runMemoryCli } from "./commands/memory.js";
import { runPersonaCli, runSpecialistCli } from "./commands/persona.js";
import { runRunCli } from "./commands/run.js";
import { runScheduleCli } from "./commands/schedule.js";
import { runWorkCli } from "./commands/work.js";
import { parseArgs } from "./helpers/args.js";
import { usage } from "./helpers/usage.js";
import type { CliOptions } from "./types.js";

export async function runCli(argv: string[], options: CliOptions = {}): Promise<string> {
  if (argv.includes("--version")) {
    return "projectathena 0.1.0";
  }

  const parsed = parseArgs(argv);
  loadConfig(options.cwd ?? process.cwd());

  if (!parsed.command) {
    return usage();
  }

  if (parsed.command !== "run") {
    if (parsed.command === "cancel") {
      return runCancelCli(argv.slice(1), options);
    }
    if (parsed.command === "work") {
      return runWorkCli(argv.slice(1), options);
    }
    if (parsed.command === "memory") {
      return runMemoryCli(argv.slice(1), options);
    }
    if (parsed.command === "schedule") {
      return runScheduleCli(argv.slice(1), options);
    }
    if (parsed.command === "persona") {
      return runPersonaCli(argv.slice(1), options);
    }
    if (parsed.command === "specialist") {
      return runSpecialistCli(argv.slice(1), options);
    }
    if (parsed.command === "api") {
      return runApiCli(argv.slice(1), options);
    }
    if (parsed.command === "agent") {
      return runAgentCli(argv.slice(1), options);
    }
    throw new Error(`Unknown command '${parsed.command}'.\n${usage()}`);
  }

  return runRunCli(argv, options);
}
