import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { loadConfig } from "../../shared/config.js";
import { createCliApiClient } from "../api-client.js";
import { parseArgs } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";
import type { CliOptions } from "../types.js";

export async function runTaskRunCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["task-run", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  if (action === "evidence-bundle") {
    const runId = parsed.flags.run ?? parsed.flags["run-id"] ?? argv[1];
    if (!runId || runId === "evidence-bundle") {
      throw new Error(`'task-run evidence-bundle' requires --run <run-id>\n${usage()}`);
    }
    const bundle = await runWithSelectedTransport(
      transport,
      async () => services.taskWorkbenchService.exportRunEvidenceBundle(runId, { destinationKind: "cli-stdout" }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.getTaskRunEvidenceBundle(runId);
      }
    );
    return JSON.stringify(bundle, null, 2);
  }

  throw new Error(`Unknown task-run action '${action}'.\n${usage()}`);
}
