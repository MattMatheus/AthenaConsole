import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST_DIR = 'dist';

// Keep this list small and stable so regressions are obvious and easy to review.
const REQUIRED_ROUTES = [
  '/',
  '/blog',
  '/docs',
  '/blog/introducing-team-orchestrator',
  '/docs/getting-started',
];

const WEBSITE_ORIGIN = 'https://teamorchestrator.com';

const toLocalCandidates = (pathname) => {
  const cleanPath = pathname.replace(/\/+$/, '');
  if (pathname === '/') return [join(DIST_DIR, 'index.html')];

  const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
  const withoutLeadingSlash = pathname.replace(/^\/+/, '');

  if (hasExtension) {
    return [join(DIST_DIR, withoutLeadingSlash)];
  }

  if (pathname.endsWith('/')) {
    return [join(DIST_DIR, withoutLeadingSlash, 'index.html')];
  }

  return [
    join(DIST_DIR, withoutLeadingSlash),
    join(DIST_DIR, withoutLeadingSlash, 'index.html'),
    join(DIST_DIR, `${withoutLeadingSlash}.html`),
    join(DIST_DIR, cleanPath.replace(/^\/+/, ''), 'index.html'),
  ];
};

const ensureDistExists = () => {
  if (!existsSync(DIST_DIR)) {
    throw new Error('Missing dist/ output. Run `npm run build` before `npm run check:static`.');
  }
};

const collectHtmlFiles = (dir) => {
  const files = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
};

const toRoutePathFromHtml = (htmlFile) => {
  const rel = relative(DIST_DIR, htmlFile).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'index.html'.length)}`;
  }
  return `/${rel}`;
};

const findBrokenInternalLinks = (htmlFiles) => {
  const broken = [];
  const anchorHrefRegex = /<a\b[^>]*\bhref="([^"]+)"/gi;

  for (const htmlFile of htmlFiles) {
    const routePath = toRoutePathFromHtml(htmlFile);
    const html = readFileSync(htmlFile, 'utf8');

    for (const match of html.matchAll(anchorHrefRegex)) {
      const href = match[1];

      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) {
        continue;
      }

      const url = new URL(href, `${WEBSITE_ORIGIN}${routePath}`);
      if (url.origin !== WEBSITE_ORIGIN) continue;

      const pathCandidates = toLocalCandidates(url.pathname);
      const isResolved = pathCandidates.some((candidate) => existsSync(candidate));

      if (!isResolved) {
        broken.push({
          sourceFile: htmlFile,
          sourceRoute: routePath,
          href,
          targetPathname: url.pathname,
        });
      }
    }
  }

  return broken;
};

const missingRoutes = REQUIRED_ROUTES.filter((route) => {
  const pathname = route === '/' ? '/' : route.replace(/\/+$/, '');
  return !toLocalCandidates(pathname).some((candidate) => existsSync(candidate));
});

const main = () => {
  ensureDistExists();
  const htmlFiles = collectHtmlFiles(DIST_DIR);
  const brokenLinks = findBrokenInternalLinks(htmlFiles);

  if (missingRoutes.length > 0 || brokenLinks.length > 0) {
    console.error('Static smoke check failed.');

    if (missingRoutes.length > 0) {
      console.error('\nMissing required routes:');
      for (const route of missingRoutes) {
        console.error(`- ${route}`);
      }
    }

    if (brokenLinks.length > 0) {
      console.error('\nBroken internal links:');
      for (const entry of brokenLinks) {
        console.error(
          `- ${entry.href} (resolved: ${entry.targetPathname}) from ${entry.sourceRoute} [${entry.sourceFile}]`,
        );
      }
    }

    process.exit(1);
  }

  console.log(
    `Static smoke check passed: ${REQUIRED_ROUTES.length} required routes and ${htmlFiles.length} HTML files validated.`,
  );
};

main();
