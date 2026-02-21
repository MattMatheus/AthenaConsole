---
title: Content Templates and QA Checklist
description: Standard templates, metadata conventions, and pre-publish quality checks for docs and blog content.
sidebar:
  order: 2
---

Use this guide when creating or updating content for the Team Orchestrator website.

## Frontmatter templates

### Docs template

```md
---
title: Example Doc Title
description: One-sentence summary of what this page helps the reader accomplish.
sidebar:
  order: 1
---
```

### Blog template

```md
---
title: Example Blog Title
description: One-sentence summary for list pages and social previews.
pubDate: 2026-02-19
updatedDate: 2026-02-19
author: Team Orchestrator
tags:
  - operations
  - launch
draft: true
---
```

## Required metadata and naming conventions

### Docs metadata

Required fields:
- `title`
- `description`

Optional fields:
- `sidebar.order` (for manual sorting)
- `sidebar.label` (if different from title)
- `sidebar.badge` (for status/new markers)

### Blog metadata

Required fields:
- `title`
- `description`
- `pubDate`

Recommended for consistency:
- `updatedDate`
- `author`
- `tags`
- `draft`

### Naming conventions

- Use kebab-case file names.
- Keep tags in lowercase kebab-case.
- Keep `description` to one specific sentence focused on reader value.

## SEO and social metadata conventions

- Canonical URLs are generated automatically in the shared layout from each route path.
- Open Graph and Twitter card tags are generated from each route's `title` and `description`.
- Keep route-level `title` and `description` specific; these fields power both HTML metadata and social previews.
- For detail pages (for example `/blog/*` posts and `/docs/*` docs), use `ogType="article"` in route templates.
- For index and landing pages, use `ogType="website"`.
- If a route needs a custom canonical path or social image in the future, pass explicit metadata props through `Layout.astro` instead of hardcoding tags in page templates.

## Pre-publish QA checks

Before publish:

1. Frontmatter matches template and schema expectations.
2. Heading structure is clean and scannable.
3. Links resolve (internal and external).
4. Summary quality is specific and accurate.
5. Route behavior is valid under `/docs/*` or `/blog/*`.
6. Build passes with `npm run build`.

## Post types guidance

### Release notes

- Include a clear version/date anchor in the title.
- Use sections for Highlights, Fixes, Operational Impact, and Next Steps.
- Link to any canonical docs updated by the release.

### Mission updates

- Structure around objective, status, decisions, and next milestones.
- Maintain Team Orchestrator mission-control framing.
- Prioritize operational clarity over promotional phrasing.
