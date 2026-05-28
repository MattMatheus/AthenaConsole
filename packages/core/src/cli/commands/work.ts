import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runWorkCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["work", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  const sessionId = parsed.flags.session;

  if (action === "enqueue") {
    if (!sessionId) {
      throw new Error(`'work enqueue' requires --session\n${usage()}`);
    }
    const input = parsed.flags.input;
    if (!input) {
      throw new Error(`'work enqueue' requires --input\n${usage()}`);
    }
    const modeFlag = parsed.flags.mode ?? "followup";
    if (modeFlag !== "followup" && modeFlag !== "collect") {
      throw new Error(`Invalid --mode '${modeFlag}'. Expected 'followup' or 'collect'.\n${usage()}`);
    }
    const mode = modeFlag;
    const queue = await runWithSelectedTransport(
      transport,
      async () =>
        services.workService.enqueue({
          sessionId,
          payload: input,
          mode
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.enqueueWork({
          sessionId,
          payload: input,
          mode
        });
      }
    );
    return JSON.stringify(
      {
        sessionId,
        queuedItems: queue.items.length,
        queueDepth: queue.items.length
      },
      null,
      2
    );
  }

  if (action === "status") {
    const workflowId = parsed.flags.workflow;
    if (workflowId) {
      throw new Error(
        "'work status --workflow' was removed with the legacy file-backed workflow surface. Use /api/v1/workflow-runs/:runId/status for canonical workflow DAG run status."
      );
    }
    if (sessionId && workflowId) {
      throw new Error(`'work status' accepts --session only.\n${usage()}`);
    }
    if (!sessionId) {
      throw new Error(`'work status' requires --session\n${usage()}`);
    }
    const queue = await runWithSelectedTransport(
      transport,
      async () => services.workService.status(sessionId),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.getWorkQueue(sessionId);
      }
    );
    return JSON.stringify(
      {
        sessionId,
        draining: queue.draining,
        queuedItems: queue.items.length,
        queueDepth: queue.items.length,
        modes: queue.items.map((item) => item.mode)
      },
      null,
      2
    );
  }

  if (action === "drain") {
    if (!sessionId) {
      throw new Error(`'work drain' requires --session\n${usage()}`);
    }
    const drainRequest = {
      sessionId,
      ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
      ...(parsed.flags.model ? { model: parsed.flags.model } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () =>
        services.workService.drain(sessionId, {
          ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
          ...(parsed.flags.model ? { model: parsed.flags.model } : {})
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.drainWork(drainRequest);
      }
    );

    return JSON.stringify(
      {
        sessionId,
        ...result,
        queueDepthDelta: result.queueDepthAfter - result.queueDepthBefore
      },
      null,
      2
    );
  }

  throw new Error(`Unknown work action '${action}'.\n${usage()}`);
}
