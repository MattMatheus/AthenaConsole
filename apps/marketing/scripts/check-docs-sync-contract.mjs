#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MANIFEST = "../../planning/architecture/projectathena-docs-ingestion-manifest.json";
const DEFAULT_SOURCE_ROOT = "../../packages/core/docs";
const DEFAULT_DEST_ROOT = "src/content/docs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const manifestPath = path.resolve(appRoot, DEFAULT_MANIFEST);
const sourceRoot = path.resolve(appRoot, DEFAULT_SOURCE_ROOT);
const destRoot = path.resolve(appRoot, DEFAULT_DEST_ROOT);

const assertExists = async (candidatePath, label) => {
  try {
    await fs.access(candidatePath);
  } catch {
    throw new Error(`${label} path is missing: ${candidatePath}`);
  }
};

const assertWithin = (basePath, candidatePath, label) => {
  const rel = path.relative(basePath, candidatePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${label} escapes base path: ${candidatePath}`);
  }
};

const main = async () => {
  await assertExists(manifestPath, "Default manifest");
  await assertExists(sourceRoot, "Default source root");
  await assertExists(destRoot, "Default destination root");

  const rawManifest = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (entries.length === 0) {
    throw new Error(`Manifest does not define any entries: ${manifestPath}`);
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Manifest entry must be an object.");
    }
    const { id, sourcePath, destinationSlug } = entry;
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error("Manifest entry id must be a non-empty string.");
    }
    if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
      throw new Error(`Manifest entry ${id} has invalid sourcePath.`);
    }
    if (typeof destinationSlug !== "string" || destinationSlug.trim().length === 0) {
      throw new Error(`Manifest entry ${id} has invalid destinationSlug.`);
    }

    const sourceAbsolutePath = path.resolve(sourceRoot, sourcePath);
    assertWithin(sourceRoot, sourceAbsolutePath, `sourcePath for ${id}`);
    await assertExists(sourceAbsolutePath, `sourcePath for ${id}`);

    const destinationPath = path.resolve(destRoot, `${destinationSlug}.md`);
    assertWithin(destRoot, destinationPath, `destinationSlug for ${id}`);
  }

  console.log(`Docs-sync contract check passed for ${entries.length} manifest entries.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
