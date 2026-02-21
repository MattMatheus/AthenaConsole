# Quickstart

## Prerequisites

- Node.js 20+

## Install

```bash
npm install
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Run A Turn

```bash
npm run build
npm run athena -- run --session demo --input "hello athena"
```

## Run The Code Review Persona

This expects a repo-local persona definition under `personas/`.

```bash
npm run athena -- persona run --name code-review --repo . --head my-branch --stdout summary
```

