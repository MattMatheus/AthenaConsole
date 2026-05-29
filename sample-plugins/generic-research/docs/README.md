# Generic Research Example Plugin

This sample plugin shows how to build safe, reusable local agents for personal knowledge and research tasks.

It includes:

- `research.article.summarizer.local`: summarizes provided article text or a local article/document path.
- `research.shopping.planner.local`: turns a shopping or research objective into a comparison plan.

Both examples use `@athena/pdk` helpers for task envelopes, input validation, artifacts, and output serialization. They are deterministic and do not require a model provider.

## Safety Boundaries

These examples are read-only teaching agents.

- No purchasing or checkout flows.
- No form submission.
- No credentialed browsing or scraping.
- No unattended network-write actions.
- External web access is out of scope until a future permissioned runtime explicitly approves it.

## Article Summarizer Input

```json
{
  "article": {
    "title": "Local-first agents",
    "text": "Paste article text here."
  },
  "maxBullets": 5
}
```

You can also pass a local file path:

```json
{
  "article": {
    "path": "/absolute/path/to/article.md"
  }
}
```

## Shopping Planner Input

```json
{
  "objective": "Find a comfortable office chair",
  "constraints": {
    "budget": "$300",
    "mustHave": ["adjustable arms", "good lumbar support"]
  },
  "preferences": {
    "style": "quiet and durable",
    "avoid": ["bonded leather"]
  },
  "decisionDeadline": "this weekend"
}
```

## Generalizing These Examples

Use these agents as templates for custom plugins:

1. Define manifest-compatible inputs with clear required fields.
2. Keep runtime permissions narrow and explicit.
3. Parse the Team Orchestrator task envelope with `parseAgentTaskRunEnvelope`.
4. Validate inputs with `parseAgentEnvelopeInputs`.
5. Return structured output plus markdown artifact metadata with `createAgentRunOutput`.

When you need model-backed behavior, add a manifest provider requirement and keep local deterministic tests for the no-provider development path.

## Validation

From the repository root:

```bash
npm --workspace @athena/pdk run build
npm --workspace @athena/core run validate:manifests
npm --workspace @athena/core exec vitest run tests/control-plane.generic-research-sample.test.ts
```
