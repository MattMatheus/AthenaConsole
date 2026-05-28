#!/usr/bin/env bash
set -euo pipefail

flywheel_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || (cd "$script_dir/../../.." && pwd)
}

flywheel_config_file() {
  printf '%s/flywheel.yaml' "$(flywheel_repo_root)"
}

flywheel_config_get() {
  local key="$1"
  ruby -e '
    require "yaml"
    path = ARGV.shift
    key = ARGV.shift
    data = YAML.load_file(path)
    value = key.split(".").reduce(data) { |acc, part| acc.fetch(part) }
    case value
    when TrueClass then puts "true"
    when FalseClass then puts "false"
    else puts value
    end
  ' "$(flywheel_config_file)" "$key"
}

flywheel_config_has() {
  local key="$1"
  ruby -e '
    require "yaml"
    path = ARGV.shift
    key = ARGV.shift
    data = YAML.load_file(path)
    found = key.split(".").reduce(data) do |acc, part|
      break :missing unless acc.is_a?(Hash) && acc.key?(part)
      acc.fetch(part)
    end
    exit(found == :missing ? 1 : 0)
  ' "$(flywheel_config_file)" "$key"
}

flywheel_config_get_optional() {
  local key="$1"
  local default_value="${2:-}"
  if flywheel_config_has "$key"; then
    flywheel_config_get "$key"
  else
    printf '%s\n' "$default_value"
  fi
}

flywheel_path() {
  local key="$1"
  local root value
  root="$(flywheel_repo_root)"
  value="$(flywheel_config_get "$key")"
  printf '%s/%s' "$root" "$value"
}

flywheel_template_path() {
  local template_key="$1"
  printf '%s/%s' "$(flywheel_path paths.templates)" "$(flywheel_config_get "templates.${template_key}")"
}

flywheel_artifact_name() {
  local pattern_key="$1"
  local token_name="$2"
  local token_value="$3"
  local pattern
  pattern="$(flywheel_config_get "artifacts.${pattern_key}")"
  pattern="${pattern//\{${token_name}\}/$token_value}"
  printf '%s' "$pattern"
}

flywheel_feature_enabled() {
  local key="$1"
  [[ "$(flywheel_config_get_optional "$key" "false")" == "true" ]]
}
