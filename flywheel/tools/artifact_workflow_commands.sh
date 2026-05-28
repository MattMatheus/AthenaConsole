#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

stage=""
phase=""
cycle_id=""

usage() {
  cat <<USAGE
usage: flywheel/tools/artifact_workflow_commands.sh --stage <planning|architect|engineering|qa|pm|cycle|observer> --phase <entry|exit> [--cycle-id <id>]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage)
      stage="${2:-}"
      shift 2
      ;;
    --phase)
      phase="${2:-}"
      shift 2
      ;;
    --cycle-id)
      cycle_id="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown arg '$1'" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$stage" || -z "$phase" ]]; then
  usage >&2
  exit 1
fi

case "$phase" in
  entry|exit)
    ;;
  *)
    echo "error: --phase must be one of: entry, exit" >&2
    exit 1
    ;;
esac

args=("$stage" "--format" "json")
if [[ -n "$cycle_id" ]]; then
  args+=("--cycle-id" "$cycle_id")
fi

json_output="$("$script_dir/artifact_workflow.sh" "${args[@]}")"
if [[ -z "$json_output" ]]; then
  exit 0
fi

ruby -r json -e '
  payload = JSON.parse(STDIN.read)
  workflow = payload.fetch("artifact_workflow", {})
  commands = workflow.fetch(ARGV.fetch(0), [])
  commands.each { |cmd| puts cmd }
' "$phase" <<< "$json_output"
