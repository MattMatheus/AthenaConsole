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

## Run The Code Review Persona

This expects a repo-local persona definition under `personas/`.

```bash
npm run athena -- persona run --name code-review --repo . --head my-branch --stdout summary
```
