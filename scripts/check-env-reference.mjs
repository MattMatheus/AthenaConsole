#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const configPath = resolve(repoRoot, "packages/core/src/shared/config.ts");
const referencePath = resolve(repoRoot, "server.env.example");

const configText = readFileSync(configPath, "utf8");
const referenceText = readFileSync(referencePath, "utf8");

const configVars = [...new Set(configText.match(/ATHENA_[A-Z0-9_]+/g) ?? [])].sort();
const missing = configVars.filter((name) => !referenceText.includes(name));

if (missing.length > 0) {
  console.error("server.env.example is missing ATHENA_* variables read by config.ts:");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

console.log(`Documented ${configVars.length} ATHENA_* variables from config.ts in server.env.example.`);
