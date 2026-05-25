import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePluginPackage } from "../src/control-plane/manifests/index.js";

const examplesRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas",
  "team-orchestrator",
  "manifests",
  "v1",
  "examples"
);
const exampleNames = readdirSync(examplesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let failed = false;
for (const exampleName of exampleNames) {
  const exampleRoot = resolve(examplesRoot, exampleName);
  const result = validatePluginPackage(exampleRoot);
  if (result.ok) {
    console.log(`ok ${exampleName}`);
    continue;
  }

  failed = true;
  console.error(`failed ${exampleName}`);
  for (const issue of result.issues) {
    console.error(`  ${issue.file ?? "manifest"} ${issue.path}: ${issue.message}`);
  }
}

if (failed) {
  process.exitCode = 1;
}
