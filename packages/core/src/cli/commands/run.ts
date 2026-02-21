import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { collectRepeatedFlagValues, parseArgs, parseTemplateParamFlags } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";

export async function runRunCli(argv: string[], options: CliOptions): Promise<string> {
  const parsed = parseArgs(argv);
  const config = loadConfig(options.cwd ?? process.cwd());

  const transport = resolveCliTransport(parsed.flags, config);
  const templateId = parsed.flags.template;
  if (templateId) {
    if (parsed.flags.input) {
      throw new Error(`'run --template' cannot be combined with --input\n${usage()}`);
    }
    const paramValues = collectRepeatedFlagValues(argv, "param");
    const params = parseTemplateParamFlags(paramValues);
    const templateRunRequest = {
      ...(parsed.flags.session ? { sessionId: parsed.flags.session } : {}),
      ...(Object.keys(params).length > 0 ? { params } : {})
    };
    const result = await runWithSelectedTransport(
      transport,
      async () => {
        const services = createLocalControlPlaneServices({ config });
        try {
          return await services.runTemplateService.run(templateId, templateRunRequest);
        } finally {
          await services.shutdown?.();
        }
      },
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.runTemplate({
          id: templateId,
          ...(Object.keys(params).length > 0 ? { params } : {})
        });
      }
    );
    return JSON.stringify(result, null, 2);
  }

  const sessionId = parsed.flags.session;
  const input = parsed.flags.input;
  if (!sessionId || !input) {
    throw new Error(`'run' requires --session and --input (or use --template)\n${usage()}`);
  }

  const runRequest = {
    sessionId,
    input,
    ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
    ...(parsed.flags.model ? { model: parsed.flags.model } : {})
  };
  const result = await runWithSelectedTransport(
    transport,
    async () => {
      const services = createLocalControlPlaneServices({ config });
      try {
        return await services.runService.run(runRequest);
      } finally {
        await services.shutdown?.();
      }
    },
    async (apiBaseUrl, timeoutMs) => {
      const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
      return client.run(runRequest);
    }
  );

  return JSON.stringify(result, null, 2);
}
