import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import { loadConfig } from "../../shared/config.js";
import { createLocalControlPlaneServices } from "../../control-plane/services.js";
import { createCliApiClient } from "../api-client.js";
import type { CliOptions } from "../types.js";
import { parseArgs } from "../helpers/args.js";
import { runWithSelectedTransport, resolveCliTransport } from "../helpers/transport.js";
import { usage } from "../helpers/usage.js";
import { assemblePersonaContextPack } from "../../personas/context-pack.js";
import { assertValidPersonaName, loadPersonaDefinition, resolvePersonaDefinitionPath } from "../../personas/loader.js";
import { scaffoldPersona } from "../../personas/scaffold.js";

async function askPersonaInitQuestion(question: string, defaultValue: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stderr });
  try {
    const answer = await rl.question(`${question} [${defaultValue}]: `);
    return answer.trim().length > 0 ? answer.trim() : defaultValue;
  } finally {
    rl.close();
  }
}

function resolvePersonaName(action: string, argv: string[], parsedFlags: Record<string, string>): string {
  const name = parsedFlags.name ?? argv[1];
  if (!name) {
    throw new Error(`'specialist ${action}' requires a specialist name via --name or positional argument.\n${usage()}`);
  }
  assertValidPersonaName(name);
  return name;
}

async function runSpecialistAction(argv: string[], options: CliOptions): Promise<string> {
  const parsed = parseArgs(["specialist", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const services = createLocalControlPlaneServices({ config });
  const transport = resolveCliTransport(parsed.flags, config);

  const name = parsed.flags.name;
  const repo = parsed.flags.repo;
  const head = parsed.flags.head;
  if (!name || !repo || !head) {
    throw new Error(`'specialist run' requires --name --repo --head\n${usage()}`);
  }

  const stdoutMode = parsed.flags.stdout;
  if (stdoutMode && !["summary", "json", "md", "none"].includes(stdoutMode)) {
    throw new Error(`Invalid --stdout '${stdoutMode}'. Expected summary|json|md|none.`);
  }

  const runRequest = {
    name,
    repoPath: repo,
    headRef: head,
    ...(parsed.flags.base ? { baseRef: parsed.flags.base } : {}),
    ...(parsed.flags.session ? { sessionId: parsed.flags.session } : {}),
    ...(parsed.flags["out-json"] ? { outJsonPath: parsed.flags["out-json"] } : {}),
    ...(parsed.flags["out-md"] ? { outMarkdownPath: parsed.flags["out-md"] } : {}),
    ...(stdoutMode ? { stdout: stdoutMode as "summary" | "json" | "md" | "none" } : {}),
    ...(parsed.flags.provider ? { provider: parsed.flags.provider } : {}),
    ...(parsed.flags.model ? { model: parsed.flags.model } : {})
  };

  const startedAt = Date.now();
  process.stderr.write(
    `specialist run status=running name=${name} compare=${parsed.flags.base ?? "(auto)"}..${head} transport=${transport.mode}\n`
  );

  try {
    const response = await runWithSelectedTransport(
      transport,
      async () => services.specialistService.run(runRequest),
      async (apiBaseUrl, timeoutMs) => {
        const client = createCliApiClient({ baseUrl: apiBaseUrl, timeoutMs });
        return client.runSpecialist(runRequest);
      }
    );

    const elapsedMs = Math.max(0, Date.now() - startedAt);
    process.stderr.write(`specialist run status=${response.result.status} runId=${response.result.runId} elapsedMs=${elapsedMs}\n`);
    return response.stdout;
  } catch (error) {
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`specialist run status=failed elapsedMs=${elapsedMs} error=${message}\n`);
    throw error;
  }
}

async function initSpecialistAction(argv: string[], options: CliOptions): Promise<string> {
  const parsed = parseArgs(["specialist", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const name = resolvePersonaName("init", argv, parsed.flags);

  const ask = options.specialistPrompt?.ask ?? options.personaPrompt?.ask ?? askPersonaInitQuestion;
  const role = parsed.flags.role ?? (await ask("What is the primary role of this agent?", "Code reviewer"));
  const description =
    parsed.flags.description ??
    (await ask("What is the primary objective for this persona?", "Review changes and return actionable findings."));

  const scaffolded = await scaffoldPersona({
    workspaceRoot: config.workspaceRoot,
    name,
    role,
    description
  });

  const persona = await loadPersonaDefinition(config.workspaceRoot, name);
  await assemblePersonaContextPack({
    workspaceRoot: config.workspaceRoot,
    persona
  });

  return JSON.stringify(
    {
      status: "ok",
      action: "specialist.init",
      name,
      manifestPath: scaffolded.manifestPath,
      specialistDir: scaffolded.specialistDir,
      definitionPath: scaffolded.definitionPath,
      nestedDefinitionPath: scaffolded.nestedDefinitionPath,
      personaDir: scaffolded.personaDir,
      files: scaffolded.files
    },
    null,
    2
  );
}

async function validateSpecialistAction(argv: string[], options: CliOptions): Promise<string> {
  const parsed = parseArgs(["specialist", ...argv]);
  const config = loadConfig(options.cwd ?? process.cwd());
  const name = resolvePersonaName("validate", argv, parsed.flags);

  const persona = await loadPersonaDefinition(config.workspaceRoot, name);
  const contextPack = await assemblePersonaContextPack({
    workspaceRoot: config.workspaceRoot,
    persona
  });

  return JSON.stringify(
    {
      status: "ok",
      action: "specialist.validate",
      name,
      definitionPath: resolvePersonaDefinitionPath(config.workspaceRoot, name),
      contextFiles: contextPack.manifest.totals.loadedFiles,
      contextChars: contextPack.manifest.totals.loadedChars
    },
    null,
    2
  );
}

export async function runSpecialistCli(argv: string[], options: CliOptions): Promise<string> {
  const action = argv[0];
  if (action === "run") {
    return runSpecialistAction(argv, options);
  }
  if (action === "init") {
    return initSpecialistAction(argv, options);
  }
  if (action === "validate") {
    return validateSpecialistAction(argv, options);
  }

  throw new Error(`Unknown specialist action '${action}'.\n${usage()}`);
}

export const runPersonaCli = runSpecialistCli;
