<!-- AUDIENCE: Internal/Technical -->

# Detailed Setup Guide

## Prerequisites

- Node.js 20+
- Git (for persona workflows like code review)

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

## CLI Basics

Run a single turn:

```bash
npm run athena -- run --session demo --input "hello athena"
```

Run a persona:

```bash
npm run athena -- persona run --name code-review --repo . --head my-branch --stdout summary
```

Work queues:

```bash
npm run athena -- work enqueue --session demo --input "task 1" --mode followup
npm run athena -- work status --session demo
npm run athena -- work drain --session demo
```

Schedules:

```bash
npm run athena -- schedule add --id heartbeat --session demo --input "heartbeat check" --every-minutes 15 --start-now true
npm run athena -- schedule list
npm run athena -- schedule run --id heartbeat
npm run athena -- schedule tick
npm run athena -- schedule logs --id heartbeat --limit 10
```

