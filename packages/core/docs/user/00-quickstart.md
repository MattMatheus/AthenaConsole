# Quickstart

## Prerequisites

- Node.js 20+

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
