#!/usr/bin/env node
import { runCli } from "./index.js";

async function main(): Promise<void> {
  const output = await runCli(process.argv.slice(2));
  process.stdout.write(`${output}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
