#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/lib/config.sh"

stage="${1:-}"
cycle_id=""
format="text"

usage() {
  cat <<USAGE
usage: flywheel/tools/artifact_workflow.sh <planning|architect|engineering|qa|pm|cycle|observer> [--cycle-id <id>] [--format text|json]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    planning|architect|engineering|qa|pm|cycle|observer)
      stage="$1"
      shift
      ;;
    --cycle-id)
      cycle_id="${2:-}"
      shift 2
      ;;
    --format)
      format="${2:-}"
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

if [[ -z "$stage" ]]; then
  usage >&2
  exit 1
fi

case "$format" in
  text|json)
    ;;
  *)
    echo "error: --format must be one of: text, json" >&2
    exit 1
    ;;
esac

if ! flywheel_feature_enabled "integrations.artifact_workflow.enabled"; then
  exit 0
fi

artifact_command="$(flywheel_config_get_optional "integrations.artifact_workflow.command")"
if [[ -z "$artifact_command" ]]; then
  if [[ "$format" == "json" ]]; then
    ruby -r json -e 'puts JSON.pretty_generate({artifact_workflow: {enabled: true, warning: "integrations.artifact_workflow.command is not configured"}})'
  else
    echo "artifact_workflow:"
    echo "  enabled: true"
    echo "  warning: integrations.artifact_workflow.command is not configured"
  fi
  exit 0
fi

observer_name=""
if [[ -n "$cycle_id" ]]; then
  observer_name="$(flywheel_artifact_name observer_report_pattern cycle_id "$cycle_id")"
fi

common_entry=(
  "$artifact_command select --ready true --stage planning /mounts/planning"
)

planning_exit=(
  "$artifact_command manifest create --purpose architect-handoff --select '/mounts/planning::planning-output?ready=true&stage=planning&kind=planning_note'"
)

cycle_exit=(
  "$artifact_command manifest create --purpose cycle-closure --select '/mounts/planning::input-plan?ready=true&stage=planning'"
)

if [[ -n "$observer_name" ]]; then
  cycle_exit+=("$artifact_command manifest create --purpose cycle-closure --select '/mounts/planning::input-plan?ready=true&stage=planning' --from '/mounts/observer/${observer_name}::observer-output'")
fi

entry_commands=()
exit_commands=()
warning=""

case "$stage" in
  planning)
    entry_commands=("${common_entry[@]}")
    exit_commands=("${planning_exit[@]}")
    ;;
  architect|engineering)
    entry_commands=("${common_entry[@]}")
    ;;
  qa|cycle)
    entry_commands=("${common_entry[@]}")
    exit_commands=("${cycle_exit[@]}")
    ;;
  observer)
    exit_commands=("${cycle_exit[@]}")
    ;;
  pm)
    ;;
  *)
    warning="unsupported stage '$stage'"
    ;;
esac

if [[ "$format" == "json" ]]; then
  json_array() {
    ruby -r json -e 'puts JSON.generate(ARGV)' "$@"
  }

  ruby -r json -e '
    payload = {
      artifact_workflow: {
        enabled: true,
        stage: ARGV.shift,
        command: ARGV.shift,
        entry: JSON.parse(ARGV.shift),
        exit: JSON.parse(ARGV.shift)
      }
    }
    warning = ARGV.shift
    payload[:artifact_workflow][:warning] = warning unless warning.empty?
    puts JSON.pretty_generate(payload)
  ' \
    "$stage" \
    "$artifact_command" \
    "$(json_array "${entry_commands[@]}")" \
    "$(json_array "${exit_commands[@]}")" \
    "$warning"
  exit 0
fi

print_commands() {
  local heading="$1"
  shift
  local cmd
  [[ $# -eq 0 ]] && return 0
  echo "  ${heading}:"
  for cmd in "$@"; do
    echo "    - $cmd"
  done
}

echo "artifact_workflow:"
echo "  enabled: true"
echo "  stage: $stage"
echo "  command: $artifact_command"
print_commands "entry" "${entry_commands[@]}"
print_commands "exit" "${exit_commands[@]}"
if [[ -n "$warning" ]]; then
  echo "  warning: $warning"
fi
