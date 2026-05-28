#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/lib/config.sh"

root_dir="$(flywheel_repo_root)"

check_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo "PASS: $path"
  else
    echo "FAIL: missing $path" >&2
    return 1
  fi
}

check_dir() {
  local path="$1"
  if [[ -d "$path" ]]; then
    echo "PASS: $path"
  else
    echo "FAIL: missing $path" >&2
    return 1
  fi
}

check_file "$root_dir/flywheel.yaml"
check_file "$root_dir/flywheel/CONFIG_SCHEMA.md"
check_file "$root_dir/flywheel/README.md"
check_file "$root_dir/flywheel/HUMANS.md"
check_file "$root_dir/flywheel/AGENTS.md"
check_file "$root_dir/flywheel/DEVELOPMENT_CYCLE.md"
check_file "$root_dir/flywheel/stage_contracts.yaml"
check_file "$root_dir/flywheel/tools/README.md"
check_file "$root_dir/flywheel/examples/STORY_LIFECYCLE_EXAMPLE.md"

check_dir "$(flywheel_path paths.prompts)"
check_dir "$(flywheel_path paths.roles)"
check_dir "$(flywheel_path paths.process)"
check_dir "$(flywheel_path paths.templates)"
check_dir "$(flywheel_path paths.artifacts.planning)"
check_dir "$(flywheel_path paths.artifacts.observer)"
check_dir "$(flywheel_path paths.engineering.active)"
check_dir "$(flywheel_path paths.architecture.active)"

check_file "$(flywheel_template_path story)"
check_file "$(flywheel_template_path bug)"
check_file "$(flywheel_template_path architecture_story)"
check_file "$(flywheel_template_path observer_report)"

check_file "$root_dir/flywheel/tools/launch_stage.sh"
check_file "$root_dir/flywheel/tools/artifact_workflow.sh"
check_file "$root_dir/flywheel/tools/artifact_workflow_commands.sh"
check_file "$root_dir/flywheel/tools/flywheel_doctor.sh"
check_file "$root_dir/flywheel/tools/flywheel_approval.sh"
check_file "$root_dir/flywheel/tools/flywheel_state.sh"
check_file "$root_dir/flywheel/tools/run_observer_cycle.sh"
check_file "$root_dir/flywheel/tools/validate_intake_items.sh"
check_file "$root_dir/flywheel/tools/validate_workflow_state.sh"
check_file "$root_dir/flywheel/tools/lib/flywheel_config.py"
check_file "$root_dir/flywheel/tools/lib/flywheel_approval.py"
check_file "$root_dir/flywheel/tools/lib/flywheel_doctor.py"
check_file "$root_dir/flywheel/tools/lib/flywheel_state.py"
check_file "$root_dir/flywheel/tools/lib/run_observer_cycle.py"
check_file "$root_dir/flywheel/tools/lib/stage_context.py"
check_file "$root_dir/flywheel/tools/lib/validate_workflow_state.py"

"$root_dir/flywheel/tools/validate_intake_items.sh"
"$root_dir/flywheel/tools/validate_workflow_state.sh"
"$root_dir/flywheel/tools/flywheel_doctor.sh"

echo "Result: PASS"
