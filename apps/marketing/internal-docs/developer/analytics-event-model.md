# Website Analytics Event Model

This document defines the baseline analytics contract for TeamOrchestrator.com.

## Goals

- Capture core engagement events for CTA actions, docs navigation, and blog engagement.
- Keep instrumentation provider-agnostic and optional.
- Preserve static-build reliability and stable URLs.

## Event Taxonomy (v1)

- `cta_click`
  - Used for conversion-oriented calls to action (for example, early-access and contact actions).
- `navigation_click`
  - Used for primary site navigation links (brand, Platform, Blog, Docs).
- `docs_navigation_click`
  - Used for docs list/sidebar/detail navigation clicks.
- `docs_toc_click`
  - Used for "On this page" heading navigation in docs detail pages.
- `blog_post_click`
  - Used when a blog post link is selected from lists or related surfaces.
- `blog_tag_click`
  - Used when a blog tag link is selected.
- `blog_archive_click`
  - Used when archive-year navigation is selected.
- `blog_pagination_click`
  - Used when paginated blog navigation is selected.
- `blog_navigation_click`
  - Used for blog index utility navigation (for example, "View all tags", "View full archive").

## Payload Schema (v1)

Each emitted event includes:

- `eventVersion` (number): currently `1`.
- `eventName` (string): taxonomy value above.
- `category` (string): broad domain (`cta`, `navigation`, `docs`, `blog`, etc.).
- `label` (string): compact item identifier (slug, action id, or link label).
- `location` (string): page/surface location where click occurred.
- `pathname` (string): current page path.
- `href` (string | undefined): absolute anchor URL for link-based events.
- `timestamp` (string): ISO-8601 UTC timestamp.

## Instrumentation Contract

Instrumentation is driven by `data-analytics-*` attributes:

- `data-analytics-event` (required)
- `data-analytics-category` (optional; defaults to `general`)
- `data-analytics-label` (optional; defaults to clicked text)
- `data-analytics-location` (optional; defaults to `unknown`)

`Button.astro` exposes matching props for consistent usage in reusable CTA surfaces:

- `analyticsEvent`
- `analyticsCategory`
- `analyticsLabel`
- `analyticsLocation`

## Runtime Emission (Optional Integrations)

The shared layout runtime emits each event to three optional sinks:

1. `window` custom event:
   - `team-orchestrator:analytics`
   - payload available under `event.detail`
2. `window.dataLayer`:
   - pushes `{ event: "team_orchestrator_event", ...payload }` when `dataLayer` exists
3. Adapter hook:
   - calls `window.teamOrchestratorAnalytics.track(payload)` when provided

If no sink is configured, events are ignored after collection. This is expected behavior.

## Integration Notes

- Keep event names stable once consumed by reporting/dashboard tooling.
- If schema changes are needed, increment `eventVersion` and update this document.
- Prefer additive event fields to reduce downstream break risk.
