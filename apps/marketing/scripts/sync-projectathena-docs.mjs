#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const GENERATED_HEADER = [
  '<!-- GENERATED FILE: DO NOT EDIT -->',
  '<!-- Source: projectathena/docs via internal-docs/architecture/projectathena-docs-ingestion-manifest.json -->',
].join('\n');

const DEFAULT_MANIFEST = 'internal-docs/architecture/projectathena-docs-ingestion-manifest.json';
const DEFAULT_DEST_ROOT = 'src/content/docs';
const DEFAULT_SOURCE_ROOT = '~/Source/projectathena/docs';
const DEFAULT_SECTION = 'Reference';
const DEFAULT_SECTION_ORDER = 3;
const DEFAULT_SYNCED_AT = '1970-01-01T00:00:00.000Z';

const parseArgs = (argv) => {
  const args = {
    manifest: DEFAULT_MANIFEST,
    sourceRoot: process.env.PROJECTATHENA_DOCS_ROOT || DEFAULT_SOURCE_ROOT,
    destRoot: DEFAULT_DEST_ROOT,
    sourceCommit: 'unknown',
    syncedAt: DEFAULT_SYNCED_AT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--manifest' && next) {
      args.manifest = next;
      index += 1;
    } else if (arg === '--source-root' && next) {
      args.sourceRoot = next;
      index += 1;
    } else if (arg === '--dest-root' && next) {
      args.destRoot = next;
      index += 1;
    } else if (arg === '--source-commit' && next) {
      args.sourceCommit = next;
      index += 1;
    } else if (arg === '--synced-at' && next) {
      args.syncedAt = next;
      index += 1;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
};

const printHelp = () => {
  console.log(`Usage: node scripts/sync-projectathena-docs.mjs [options]

Options:
  --manifest <path>       Manifest path (default: ${DEFAULT_MANIFEST})
  --source-root <path>    Root path for projectathena/docs (default: ${DEFAULT_SOURCE_ROOT})
  --dest-root <path>      Destination docs content root (default: ${DEFAULT_DEST_ROOT})
  --source-commit <sha>   Traceability commit value (default: unknown)
  --synced-at <iso-time>  lastSyncedAt value (default: ${DEFAULT_SYNCED_AT})
  --help                  Show this help output
`);
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const parseSimpleFrontmatter = (content) => {
  if (!content.startsWith('---\n')) {
    return { frontmatter: {}, body: content.trim() };
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { frontmatter: {}, body: content.trim() };
  }

  const rawFrontmatter = content.slice(4, endIndex).trim();
  const body = content.slice(endIndex + 5).trim();
  const frontmatter = {};

  for (const line of rawFrontmatter.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    frontmatter[key] = value;
  }

  return { frontmatter, body };
};

const ensureIsoTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid --synced-at value: ${value}`);
  }
  return date.toISOString();
};

const normalizeDescription = (value) => value?.replace(/\s+/g, ' ').trim() ?? '';
const extractMarkdownTitle = (body) => {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
};

const buildFrontmatter = ({
  title,
  description,
  destinationSlug,
  manifestId,
  sourcePath,
  sourceCommit,
  syncedAt,
  order,
}) => `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
audience: "public"
section: ${JSON.stringify(DEFAULT_SECTION)}
sectionOrder: ${DEFAULT_SECTION_ORDER}
order: ${order}
sourcePath: ${JSON.stringify(sourcePath)}
sourceCommit: ${JSON.stringify(sourceCommit)}
lastSyncedAt: ${JSON.stringify(syncedAt)}
generatedBy: "scripts/sync-projectathena-docs.mjs"
generatedFromManifestId: ${JSON.stringify(manifestId)}
---
`;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const collectMarkdownFiles = async (rootPath) => {
  const files = [];
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
};

const ensureManagedWrite = async (targetPath, content) => {
  try {
    const existing = await fs.readFile(targetPath, 'utf8');
    if (!existing.includes('<!-- GENERATED FILE: DO NOT EDIT -->')) {
      throw new Error(
        `Refusing to overwrite non-generated file: ${targetPath}. Move/delete it or add a managed header.`,
      );
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
};

const pruneManagedFiles = async (destRoot, managedOutputFiles) => {
  try {
    await fs.access(destRoot);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const managedSet = new Set(managedOutputFiles.map((filePath) => path.resolve(filePath)));
  const removedFiles = [];
  const files = await collectMarkdownFiles(destRoot);

  for (const filePath of files) {
    if (managedSet.has(path.resolve(filePath))) continue;

    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.includes('<!-- GENERATED FILE: DO NOT EDIT -->')) continue;

    await fs.unlink(filePath);
    removedFiles.push(path.relative(process.cwd(), filePath));
  }

  return removedFiles;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const sourceRoot = path.resolve(args.sourceRoot.replace(/^~(?=$|\/|\\)/, process.env.HOME || '~'));
  const destRoot = path.resolve(args.destRoot);
  const syncedAt = ensureIsoTimestamp(args.syncedAt);

  const manifest = await readJson(manifestPath);
  const entries = manifest.entries ?? [];
  if (entries.length === 0) {
    throw new Error(`Manifest has no entries: ${manifestPath}`);
  }

  const seenSlugs = new Set();
  const missingSources = [];
  const managedOutputFiles = [];

  entries.forEach((entry, index) => {
    if (seenSlugs.has(entry.destinationSlug)) {
      throw new Error(`Slug collision detected in manifest: ${entry.destinationSlug}`);
    }
    seenSlugs.add(entry.destinationSlug);

    if (!entry.slugLocked) {
      throw new Error(`Manifest entry must set slugLocked=true: ${entry.id}`);
    }

    if (!entry.owner?.team || !Array.isArray(entry.owner?.reviewers) || entry.owner.reviewers.length === 0) {
      throw new Error(`Manifest entry is missing owner metadata: ${entry.id}`);
    }

    if (!entry.lifecycleState) {
      throw new Error(`Manifest entry is missing lifecycleState: ${entry.id}`);
    }

    entries[index].sourceAbsolutePath = path.join(sourceRoot, entry.sourcePath);
  });

  for (const entry of entries) {
    try {
      await fs.access(entry.sourceAbsolutePath);
    } catch {
      missingSources.push(`${entry.id}: ${entry.sourcePath}`);
    }
  }

  if (missingSources.length > 0) {
    throw new Error(`Missing source files:\n${missingSources.map((item) => `- ${item}`).join('\n')}`);
  }

  const orderedEntries = [...entries].sort((a, b) => a.destinationSlug.localeCompare(b.destinationSlug));

  for (let index = 0; index < orderedEntries.length; index += 1) {
    const entry = orderedEntries[index];
    const sourceRaw = await fs.readFile(entry.sourceAbsolutePath, 'utf8');
    const { frontmatter, body } = parseSimpleFrontmatter(sourceRaw);
    const title = frontmatter.title ?? extractMarkdownTitle(body) ?? entry.id;
    const description = normalizeDescription(frontmatter.description || `${title} reference documentation.`);
    const destinationPath = path.join(destRoot, `${entry.destinationSlug}.md`);
    const frontmatterBlock = buildFrontmatter({
      title,
      description,
      destinationSlug: entry.destinationSlug,
      manifestId: entry.id,
      sourcePath: entry.sourcePath,
      sourceCommit: args.sourceCommit,
      syncedAt,
      order: index + 1,
    });

    const output = [
      frontmatterBlock.trimEnd(),
      '',
      GENERATED_HEADER,
      `<!-- Content SHA256: ${sha256(sourceRaw)} -->`,
      '',
      body,
      '',
    ].join('\n');

    await ensureManagedWrite(destinationPath, output);
    managedOutputFiles.push(destinationPath);
  }

  const removedFiles = await pruneManagedFiles(destRoot, managedOutputFiles);
  const managedOutputFilesRelative = managedOutputFiles.map((filePath) => path.relative(process.cwd(), filePath));

  console.log(`Synced ${managedOutputFilesRelative.length} docs entries from manifest.`);
  managedOutputFilesRelative.forEach((filePath) => console.log(`- ${filePath}`));

  if (removedFiles.length > 0) {
    console.log(`Removed ${removedFiles.length} stale generated docs files:`);
    removedFiles.forEach((filePath) => console.log(`- ${filePath}`));
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
