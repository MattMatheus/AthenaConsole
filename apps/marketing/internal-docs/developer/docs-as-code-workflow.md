# Docs-As-Code Workflow

This document defines the baseline for authoring, reviewing, and publishing documentation and blog content from this repository.

## 1. Lifecycle States

All docs and blog content move through the same lifecycle:

1. **Draft**
   - Work in progress.
   - Not ready for publication.
2. **In Review**
   - Author has completed an initial pass.
   - Reviewer validates clarity, metadata, route stability, and product voice.
3. **Published**
   - Content is approved and merged to the default branch.
   - Site build includes the content in docs/blog routes.
4. **Archived**
   - Content is no longer current but retained for historical context.
   - Archived content should remain discoverable without changing stable URLs where possible.

## 2. Ownership and Review Expectations

- **Author**
  - Creates and updates content in the correct section.
  - Follows metadata conventions for docs/blog frontmatter.
  - Ensures links and route paths remain stable.
- **Reviewer**
  - Confirms lifecycle state transition readiness.
  - Checks alignment with Team Orchestrator voice and product framing.
  - Confirms references to canonical operational docs are intact.
- **Cycle Owner (Agent for current slice)**
  - Runs build validation (`npm run build`).
  - Completes handoff updates (`internal-docs/archive/handoff.md`, backlog movement, next seed prompt).

## 3. Publishing Flow

### Documentation Content

1. Author or edit docs content under `src/content/docs/`.
2. Validate ordering and section placement through frontmatter (`section`, `sectionOrder`, `order`).
3. Run `npm run build`.
4. Merge after review to publish in `/docs/*` routes.

### Blog Content

1. Author or edit blog posts under `src/content/blog/`.
2. Set required metadata (`title`, `description`, `pubDate`, `tags`, `draft`).
3. Keep `draft: true` until review complete.
4. Run `npm run build`.
5. Merge after review to publish in `/blog/*` routes.

## 4. Content Templates and Metadata Conventions

Use these frontmatter templates as the baseline for all new content.

### Docs Template (for `src/content/docs/*.md`)

```md
---
title: Example Doc Title
description: One-sentence summary of what this page helps the reader accomplish.
section: Operations
sectionOrder: 2
order: 3
---
```

Required fields:
- `title` (string)
- `description` (string)
- `section` (string)
- `sectionOrder` (number)
- `order` (number)

Naming conventions:
- Use kebab-case file names (example: `content-templates-and-qa.md`).
- Keep titles concise and specific to one intent.
- Keep descriptions to one clear sentence focused on reader value.

### Blog Template (for `src/content/blog/*.md`)

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

Required fields:
- `title` (string)
- `description` (string)
- `pubDate` (date)

Strongly recommended fields for consistency:
- `updatedDate` (date, when edited after publish)
- `author` (string, default is `Team Orchestrator`)
- `tags` (array of strings)
- `draft` (boolean; keep `true` until review is complete)

Naming conventions:
- Use kebab-case file names (example: `mission-update-stage-8-progress.md`).
- Use tags in lowercase kebab-case to keep taxonomy clean.

## 5. Pre-Publish QA Checks

Before publishing docs or blog content:

1. Verify frontmatter against the templates above.
2. Validate heading structure (single H1 from title; use H2/H3 in logical order).
3. Confirm summary quality (`description` is specific, accurate, and non-generic).
4. Check links:
   - Internal links resolve to valid existing routes.
   - External links are reachable and contextually correct.
5. Validate route behavior:
   - Docs pages resolve under `/docs/<slug>/`.
   - Blog posts resolve under `/blog/<slug>/`.
   - Existing stable URLs remain unchanged.
6. Run `npm run build` and resolve any content schema/build errors.

## 6. Content Type Guidance

### Release Notes Posts

- Use a clear version/date anchor in title (example: `Release Notes: 2026-02-19`).
- Structure with sections: Highlights, Fixes, Operational Impact, Next Steps.
- Include links to canonical docs for any changed workflows.

### Mission Update Posts

- Focus on objective, current status, decisions, and upcoming milestones.
- Keep product framing aligned to Team Orchestrator mission-control language.
- Prefer operational clarity over promotional language.

## 7. Cycle Checklist Reference

Before handoff, complete `internal-docs/developer/cycle-checklist.md`.
