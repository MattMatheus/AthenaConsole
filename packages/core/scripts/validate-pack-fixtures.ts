import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadYamlManifest, validatePluginPackage } from "../src/control-plane/manifests/index.js";

interface PluginManifestDocument {
  plugin?: {
    id?: string;
    pack?: unknown;
    connector?: unknown;
    workflowTemplates?: Array<string | { path?: string; id?: string; version?: string }>;
  };
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const bundledRoot = resolve(repoRoot, "bundled-plugins");
let failed = false;

for (const packName of discoverPackNames(bundledRoot)) {
  const packRoot = resolve(bundledRoot, packName);
  const manifestPath = resolve(packRoot, "plugin.yaml");
  const validation = validatePluginPackage(packRoot);
  if (!validation.ok) {
    failed = true;
    console.error(`failed ${packName}`);
    for (const issue of validation.issues) {
      console.error(`  ${issue.file ?? "manifest"} ${issue.path}: ${issue.message}`);
    }
    continue;
  }

  const manifest = loadYamlManifest(manifestPath) as PluginManifestDocument;
  const pluginId = manifest.plugin?.id ?? packName;
  if (!manifest.plugin?.pack) {
    failed = true;
    console.error(`failed ${packName}`);
    console.error(`  ${manifestPath} $.plugin.pack: bundled packs must declare pack metadata`);
    continue;
  }

  const fixtureRoot = resolve(packRoot, "fixtures");
  const fixtureFiles = existsSync(fixtureRoot)
    ? readdirSync(fixtureRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => resolve(fixtureRoot, entry.name))
        .sort()
    : [];
  if (fixtureFiles.length === 0) {
    failed = true;
    console.error(`failed ${packName}`);
    console.error(`  ${fixtureRoot}: bundled packs must include at least one JSON fixture`);
    continue;
  }
  for (const fixtureFile of fixtureFiles) {
    try {
      const fixture = JSON.parse(readFileSync(fixtureFile, "utf8")) as unknown;
      const connectorIssues = validateConnectorFixture(manifest, fixture);
      if (connectorIssues.length > 0) {
        failed = true;
        for (const issue of connectorIssues) {
          console.error(`failed ${packName}`);
          console.error(`  ${fixtureFile}: ${issue}`);
        }
      }
    } catch (error) {
      failed = true;
      console.error(`failed ${packName}`);
      console.error(`  ${fixtureFile}: invalid JSON fixture (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  const workflowReferences = manifest.plugin.workflowTemplates ?? [];
  if (workflowReferences.length === 0) {
    failed = true;
    console.error(`failed ${packName}`);
    console.error(`  ${manifestPath} $.plugin.workflowTemplates: bundled packs should include at least one smokeable workflow`);
    continue;
  }

  console.log(`ok ${packName} (${pluginId})`);
}

if (failed) {
  process.exitCode = 1;
}

function validateConnectorFixture(manifest: PluginManifestDocument, fixture: unknown): string[] {
  if (!manifest.plugin?.connector) {
    return [];
  }
  if (!isRecord(fixture) || !isRecord(fixture.connectorFixture)) {
    return ["connector packs must include connectorFixture metadata in each JSON fixture"];
  }
  const connectorFixture = fixture.connectorFixture;
  if (connectorFixture.liveNetwork !== false) {
    return ["connectorFixture.liveNetwork must be false for bundled connector fixture validation"];
  }
  const scenarios = Array.isArray(connectorFixture.scenarios) ? connectorFixture.scenarios : [];
  const requiredScenarios = ["read-success", "write-blocked", "write-approved", "auth-missing", "scope-missing", "rate-limited"];
  const missingScenarios = requiredScenarios.filter((scenario) => !scenarios.includes(scenario));
  if (missingScenarios.length > 0) {
    return [`connectorFixture.scenarios is missing: ${missingScenarios.join(", ")}`];
  }
  return [];
}

function discoverPackNames(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
