import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { parseBooleanFlag, parsePositiveInt } from "../helpers/flags.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runScheduleCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["schedule", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  if (action === "add") {
    const id = parsed.flags.id;
    const sessionId = parsed.flags.session;
    const input = parsed.flags.input;
    const everyMinutes = parsePositiveInt(parsed.flags["every-minutes"]);
    if (!id || !sessionId || !input || !everyMinutes) {
      throw new Error(`'schedule add' requires --id --session --input --every-minutes\n${usage()}`);
    }
    const rawStartNow = parsed.flags["start-now"];
    const parsedStartNow = parseBooleanFlag(rawStartNow);
    if (rawStartNow !== undefined && parsedStartNow === undefined) {
      throw new Error(`Invalid --start-now '${rawStartNow}'. Expected true|false.`);
    }
    const startNow = parsedStartNow ?? false;
    const task = await runWithSelectedTransport(
      transport,
      async () =>
        services.scheduleService.upsert({
          id,
          sessionId,
          input,
          everyMinutes,
          startNow
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.createSchedule({
          id,
          sessionId,
          input,
          everyMinutes,
          startNow
        });
      }
    );
    return JSON.stringify(task, null, 2);
  }

  if (action === "list") {
    const tasks = await runWithSelectedTransport(
      transport,
      async () => services.scheduleService.list(),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        const result = await client.listSchedules(500);
        return result.items;
      }
    );
    return JSON.stringify({ count: tasks.length, tasks }, null, 2);
  }

  if (action === "remove") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule remove' requires --id\n${usage()}`);
    }
    const response = await runWithSelectedTransport(
      transport,
      async () => ({
        id,
        removed: await services.scheduleService.remove(id)
      }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.removeSchedule(id);
      }
    );
    return JSON.stringify({ id: response.id, removed: response.removed }, null, 2);
  }

  if (action === "logs") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule logs' requires --id\n${usage()}`);
    }
    const limit = parsePositiveInt(parsed.flags.limit) ?? 20;
    const logs = await runWithSelectedTransport(
      transport,
      async () => services.scheduleService.logs(id, { limit }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.getScheduleLogs(id, limit);
      }
    );
    return JSON.stringify({ id, count: logs.length, logs }, null, 2);
  }

  if (action === "run") {
    const id = parsed.flags.id;
    if (!id) {
      throw new Error(`'schedule run' requires --id\n${usage()}`);
    }
    const runRequest = {
      id,
      ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
      ...(parsed.flags.model ? { model: parsed.flags.model } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () =>
        services.scheduleService.run(id, {
          ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
          ...(parsed.flags.model ? { model: parsed.flags.model } : {})
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.runSchedule(runRequest);
      }
    );
    return JSON.stringify(
      {
        ...result,
        summary: {
          ok: result.status === "ok" ? 1 : 0,
          failed: result.status === "failed" ? 1 : 0,
          alreadyRunning: result.status === "already-running" ? 1 : 0
        }
      },
      null,
      2
    );
  }

  if (action === "tick") {
    const at = parsed.flags.at ? new Date(parsed.flags.at) : new Date();
    if (Number.isNaN(at.getTime())) {
      throw new Error(`Invalid --at value '${parsed.flags.at}'`);
    }
    const tickRequest = {
      at: at.toISOString(),
      ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
      ...(parsed.flags.model ? { model: parsed.flags.model } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () =>
        services.scheduleService.runDue(at, {
          ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
          ...(parsed.flags.model ? { model: parsed.flags.model } : {})
        }),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.tickSchedules(tickRequest);
      }
    );
    return JSON.stringify(
      {
        at: at.toISOString(),
        ...result,
        summary: {
          ok: result.run.filter((row) => row.status === "ok").length,
          failed: result.run.filter((row) => row.status === "failed").length,
          alreadyRunning: result.run.filter((row) => row.status === "already-running").length
        }
      },
      null,
      2
    );
  }

  throw new Error(`Unknown schedule action '${action}'.\n${usage()}`);
}
