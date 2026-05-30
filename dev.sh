#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_HOST="${ATHENA_DEV_API_HOST:-127.0.0.1}"
API_PORT="${ATHENA_DEV_API_PORT:-8787}"
UI_HOST="${ATHENA_DEV_UI_HOST:-127.0.0.1}"
UI_PORT="${ATHENA_DEV_UI_PORT:-5173}"

export ATHENA_WORKSPACE_ROOT="${ATHENA_WORKSPACE_ROOT:-$ROOT_DIR}"

pids=""

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_port() {
  local label="$1"
  local port="$2"

  if [ "${ATHENA_SKIP_PORT_CHECK:-0}" = "1" ]; then
    return
  fi

  if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "$label port $port is already in use." >&2
    echo "Stop the existing process or rerun with ATHENA_SKIP_PORT_CHECK=1." >&2
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >&2
    exit 1
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM

  if [ -n "$pids" ]; then
    echo
    echo "Stopping Team Orchestrator dev processes..."
    for pid in $pids; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done
    for pid in $pids; do
      wait "$pid" >/dev/null 2>&1 || true
    done
  fi

  exit "$status"
}

trap cleanup EXIT INT TERM

require_command node
require_command npm

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "node_modules is missing. Run npm install from $ROOT_DIR first." >&2
  exit 1
fi

check_port "API" "$API_PORT"
check_port "Console" "$UI_PORT"

echo "Starting Team Orchestrator dev environment"
echo "  API:     http://$API_HOST:$API_PORT"
echo "  Console: http://$UI_HOST:$UI_PORT"
echo "  Root:    $ATHENA_WORKSPACE_ROOT"
echo

(
  cd "$ROOT_DIR"
  ATHENA_DEV_API_HOST="$API_HOST" \
    ATHENA_DEV_API_PORT="$API_PORT" \
    ATHENA_WORKSPACE_ROOT="$ATHENA_WORKSPACE_ROOT" \
    npm --workspace @athena/api run dev
) &
pids="$pids $!"

(
  cd "$ROOT_DIR"
  ATHENA_DEV_API_HOST="$API_HOST" \
    ATHENA_DEV_API_PORT="$API_PORT" \
    ATHENA_DEV_UI_HOST="$UI_HOST" \
    ATHENA_DEV_UI_PORT="$UI_PORT" \
    npm --workspace @athena/console run dev
) &
pids="$pids $!"

echo "Press Ctrl+C to stop both processes."

while :; do
  for pid in $pids; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      wait "$pid"
      exit $?
    fi
  done
  sleep 1
done
