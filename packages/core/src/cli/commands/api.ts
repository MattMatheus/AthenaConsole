import { loadConfig } from "../../shared/config.js";
import { writeApiContractArtifact } from "../../control-plane/api-artifact.js";
import { createApiServer } from "../../api/server.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { parsePositiveInt } from "../helpers/flags.js";
import { usage } from "../helpers/usage.js";

export async function runApiCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["api", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());

  if (action === "contracts") {
    const outPath = parsed.flags.out;
    const artifact = await writeApiContractArtifact(config.workspaceRoot, outPath);
    return JSON.stringify(
      {
        status: "written",
        path: artifact.path,
        routeCount: artifact.artifact.routeCount
      },
      null,
      2
    );
  }

  if (action !== "serve") {
    throw new Error(`Unknown api action '${action}'.\n${usage()}`);
  }

  const host = parsed.flags.host ?? "127.0.0.1";
  const port = parsePositiveInt(parsed.flags.port) ?? 8787;
  const server = createApiServer({ config, host, port });
  const bound = await server.start();

  const stop = async () => {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await server.stop();
  };
  const onSignal = () => {
    void stop();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  return JSON.stringify(
    {
      status: "serving",
      host: bound.host,
      port: bound.port
    },
    null,
    2
  );
}
