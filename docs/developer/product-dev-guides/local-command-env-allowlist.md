# Local Command Environment Allowlist

Local-command agents do not inherit the full API process environment.

## Host Variables Allowed By Default

- `PATH`
- `HOME`
- `TMPDIR`
- `TEMP`
- `TMP`
- `USER`
- `LOGNAME`
- `LANG`
- `LC_ALL`
- `SYSTEMROOT`
- `COMSPEC`
- `PATHEXT`
- `ATHENA_AGENT_REPO`
- `ATHENA_AGENT_PYTHON`
- `ATHENA_AGENT_CONSOLE_RUNNER`

The run event sidecar path is injected separately as `ATHENA_CONSOLE_RUN_EVENTS_FILE` and `ATHENA_AGENT_CONSOLE_EVENTS_PATH`.

## Extension Point

Agent manifests may declare runtime environment values for their own process. Those values are merged into the allowlisted host environment for that run. Do not use manifest env values for server API tokens, model provider API keys, connector tokens, or deployment secrets.

## Verified Backends

- Local process: uses the allowlisted env plus manifest env and sidecar variables.
- AthenaAgent bridge: runs through the same local-command path.
- Docker/Kubernetes sandbox backends: receive only request/pod/container configuration and do not inherit the API process env as a child-process spawn environment.
