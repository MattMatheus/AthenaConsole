# CLI Reference

This document provides a reference for the various commands available in the `athena` CLI.

## General Usage

```bash
npm run athena -- <command> [options]
```

## Running a Session

```bash
npm run athena -- run --session <session_id> --input "<your_input>"
```

## Persona Management

### Run a Persona
Run a persona defined in the `personas/` directory.

```bash
npm run athena -- persona run --name <persona_name> --repo <path_to_repo> --head <branch_name> --stdout <output_format>
```

Example:
```bash
npm run athena -- persona run --name code-review --repo . --head my-branch --stdout summary
```

## Work Queue Management

### Enqueue Work
Add a task to a session's work queue.

```bash
npm run athena -- work enqueue --session <session_id> --input "<task_description>" --mode <mode>
```
Modes: `followup`, `collect`.

### Check Queue Status
```bash
npm run athena -- work status --session <session_id>
```

### Drain Queue
Execute all pending items in the queue.
```bash
npm run athena -- work drain --session <session_id>
```

## Schedule Management

### Add a Schedule
```bash
npm run athena -- schedule add --id <id> --session <session_id> --input "<input>" --every-minutes <minutes> --start-now <true|false>
```

### List Schedules
```bash
npm run athena -- schedule list
```

### Run a Schedule Immediately
```bash
npm run athena -- schedule run --id <id>
```

### Trigger Due Schedules
```bash
npm run athena -- schedule tick
```

### Inspect Schedule Logs
```bash
npm run athena -- schedule logs --id <id> --limit <limit>
```

## Provider Configuration

Configuration can be set via environment variables:

```bash
# choose primary provider
export ATHENA_DEFAULT_PROVIDER=local-exec
export ATHENA_DEFAULT_MODEL=local-model

# local provider command + args
export ATHENA_LOCAL_PROVIDER_CMD=/bin/echo
export ATHENA_LOCAL_PROVIDER_ARGS=prefix

# fallback order (comma-separated provider IDs)
export ATHENA_PROVIDER_FALLBACK_ORDER=mock
```
