import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runMemoryCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  const parsed = parseArgs(["memory", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  if (action === "search") {
    const query = parsed.flags.query;
    if (!query) {
      throw new Error(`'memory search' requires --query\n${usage()}`);
    }
    const searchOptions: { maxResults?: number; minScore?: number } = {};
    if (parsed.flags["max-results"] !== undefined) {
      const parsedMaxResults = Number.parseInt(parsed.flags["max-results"], 10);
      if (!Number.isFinite(parsedMaxResults) || parsedMaxResults <= 0) {
        throw new Error(`Invalid --max-results '${parsed.flags["max-results"]}'. Expected positive integer.`);
      }
      searchOptions.maxResults = parsedMaxResults;
    }
    if (parsed.flags["min-score"] !== undefined) {
      const parsedMinScore = Number.parseFloat(parsed.flags["min-score"]);
      if (!Number.isFinite(parsedMinScore) || parsedMinScore < 0) {
        throw new Error(`Invalid --min-score '${parsed.flags["min-score"]}'. Expected number >= 0.`);
      }
      searchOptions.minScore = parsedMinScore;
    }
    const results = await runWithSelectedTransport(
      transport,
      async () => services.memoryService.search(query, searchOptions),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.searchMemory({
          query,
          ...(searchOptions.maxResults !== undefined ? { maxResults: searchOptions.maxResults } : {}),
          ...(searchOptions.minScore !== undefined ? { minScore: searchOptions.minScore } : {})
        });
      }
    );
    return JSON.stringify(
      {
        query,
        count: results.length,
        results
      },
      null,
      2
    );
  }

  if (action === "get") {
    const path = parsed.flags.path;
    if (!path) {
      throw new Error(`'memory get' requires --path\n${usage()}`);
    }
    const getRequest: { path: string; from?: number; lines?: number } = { path };
    if (parsed.flags.from) {
      const parsedFrom = Number.parseInt(parsed.flags.from, 10);
      if (Number.isFinite(parsedFrom)) {
        getRequest.from = parsedFrom;
      }
    }
    if (parsed.flags.lines) {
      const parsedLines = Number.parseInt(parsed.flags.lines, 10);
      if (Number.isFinite(parsedLines)) {
        getRequest.lines = parsedLines;
      }
    }
    const result = await runWithSelectedTransport(
      transport,
      async () => services.memoryService.get(getRequest),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.getMemory(getRequest);
      }
    );
    return JSON.stringify(result, null, 2);
  }

  throw new Error(`Unknown memory action '${action}'.\n${usage()}`);
}
