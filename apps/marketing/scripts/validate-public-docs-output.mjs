import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CONTENT_ROOT = 'src/content/docs';
const DIST_ROOT = 'dist/docs';

const collectMarkdownFiles = (dir) => {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.md') || fullPath.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }

  return files;
};

const parseFrontmatter = (content) => {
  if (!content.startsWith('---\n')) {
    return {};
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return {};
  }

  const rawFrontmatter = content.slice(4, endIndex);
  const frontmatter = {};

  for (const rawLine of rawFrontmatter.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['\"]|['\"]$/g, '');

    frontmatter[key] = value;
  }

  return frontmatter;
};

const slugFromPath = (filePath) => {
  const rel = relative(CONTENT_ROOT, filePath).replace(/\\/g, '/');
  return rel.replace(/\.(md|mdx)$/i, '');
};

const slugToDistPath = (slug) => {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return join(DIST_ROOT, normalized, 'index.html');
};

const main = () => {
  if (!existsSync('dist')) {
    throw new Error('Missing dist/ output. Run `npm run build` before `npm run validate:public-docs`.');
  }

  const docFiles = collectMarkdownFiles(CONTENT_ROOT);
  const failures = [];

  for (const filePath of docFiles) {
    const raw = readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(raw);
    const audience = frontmatter.audience ?? 'public';
    const slug = frontmatter.slug || slugFromPath(filePath);
    const outputPath = slugToDistPath(slug);
    const published = existsSync(outputPath);

    if (audience === 'internal' && published) {
      failures.push(`Internal doc leaked to dist: ${slug} (${filePath})`);
    }

    if (audience === 'public' && !published) {
      failures.push(`Public doc missing from dist: ${slug} (${filePath})`);
    }
  }

  if (failures.length > 0) {
    console.error('Public docs validation failed.');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log(`Public docs validation passed for ${docFiles.length} docs files.`);
};

main();
