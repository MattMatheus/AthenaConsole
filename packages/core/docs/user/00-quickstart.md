# Quickstart

## Prerequisites

- Node.js 20+
- Docker or Podman with Compose support

## Install

```bash
npm install
```

## Verify

```bash
npm run check:schemas
npm run typecheck
npm test
npm run build
```

## Start The Local API + Console Stack (Primary Path)

```bash
podman compose -f docker-compose.local.yml up --build
```

The local compose stack binds the API for container access and sets
`ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true` explicitly. Do not use that override for LAN or production-like runs.

## Run A Turn

```bash
npm run athena -- run --session demo --input "hello athena"
```

## (Optional) Start the API Server

```bash
npm run athena -- api serve
```

## Run The Code Review Sample Agent

The current code-review example is a plugin-backed agent in `sample-plugins/code-review`. Start the API server, create a ready task assigned to `code.review.local`, then run it:

```bash
curl -X POST http://127.0.0.1:8787/api/v1/tasks \
  -H "content-type: application/json" \
  -d '{"id":"task-code-review","title":"Review current branch","status":"ready","capabilityRequirements":["code.review"],"assignedAgentId":"code.review.local","assignedAgentVersion":"0.1.0","inputs":{"repo":{"path":"."},"baseRef":"main","headRef":"HEAD"}}'

curl -X POST http://127.0.0.1:8787/api/v1/tasks/task-code-review/run \
  -H "content-type: application/json" \
  -d '{}'
```
