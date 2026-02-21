import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runCancelCli(argv: string[], options: CliOptions): Promise<string> {
  const parsed = parseArgs(["cancel", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const sessionId = parsed.flags.session;
  if (!sessionId) {
    throw new Error(`'cancel' requires --session\n${usage()}`);
  }

  const cancelRequest = {
    sessionId,
    ...(parsed.flags.reason ? { reason: parsed.flags.reason } : {})
  };
  const transport = resolveCliTransport(parsed.flags, config);
  const response = await runWithSelectedTransport(
    transport,
    async () => services.runService.cancel(cancelRequest),
    async (apiBaseUrl, timeoutMs) => {
      const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
      return client.cancel(cancelRequest);
    }
  );
  return JSON.stringify(
    {
      sessionId,
      status: response.status
    },
    null,
    2
  );
}
