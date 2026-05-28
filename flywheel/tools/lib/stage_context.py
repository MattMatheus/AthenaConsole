#!/usr/bin/env python3
"""Emit human or JSON launch context for Flywheel stages."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from flywheel_config import feature_enabled, get, git_current_branch, git_is_repo, load_config, path, rel, repo_root

QUEUE_ITEM_RE = re.compile(r"^\s*\d+\.\s*`([^`]+)`.*$")


def load_stage_contracts(root: Path) -> dict[str, Any]:
    import yaml

    contracts_path = root / "flywheel" / "stage_contracts.yaml"
    with contracts_path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("stages"), dict):
        raise RuntimeError("flywheel/stage_contracts.yaml must contain a stages mapping")
    return data["stages"]


def select_top_item(lane_dir: Path) -> Path | None:
    readme = lane_dir / "README.md"
    if readme.is_file():
        for line in readme.read_text(encoding="utf-8").splitlines():
            match = QUEUE_ITEM_RE.match(line)
            if not match:
                continue
            candidate = Path(match.group(1))
            if not candidate.is_absolute():
                candidate = lane_dir / candidate
            if candidate.is_file():
                return candidate

    candidates = sorted(item for item in lane_dir.glob("*.md") if item.name != "README.md" and item.is_file())
    return candidates[0] if candidates else None


def artifact_workflow(root: Path, stage: str, json_format: bool) -> str:
    config = load_config(root)
    if not feature_enabled(config, "integrations.artifact_workflow.enabled"):
        return ""
    script = root / "flywheel" / "tools" / "artifact_workflow.sh"
    args = [str(script), stage]
    if json_format:
        args.extend(["--format", "json"])
    return subprocess.check_output(args, text=True).strip()


def launch_payload(root: Path, config: dict[str, Any], contracts: dict[str, Any], stage: str) -> dict[str, Any]:
    contract = contracts[stage]
    prompts_dir = path(root, config, "paths.prompts")
    prompt_path = prompts_dir / contract["prompt"]

    input_lane = contract.get("input_lane")
    output_lane = contract.get("output_lane")
    story_path = None
    status = "ready"

    input_lane_key = contract.get("input_lane_key")
    if input_lane_key:
        lane_dir = path(root, config, input_lane_key)
        input_lane = rel(root, lane_dir)
        selected = select_top_item(lane_dir)
        if selected is None:
            status = "no_stories"
        else:
            story_path = rel(root, selected)

    output_lane_key = contract.get("output_lane_key")
    if output_lane_key:
        output_lane = rel(root, path(root, config, output_lane_key))

    artifact_raw = artifact_workflow(root, stage, json_format=True)
    artifact = json.loads(artifact_raw).get("artifact_workflow") if artifact_raw else None

    return {
        "launch": {
            "stage": stage,
            "status": status,
            "cycle": contract["cycle"],
            "prompt_path": str(prompt_path),
            "story_path": story_path,
            "input_lane": input_lane,
            "output_lane": output_lane,
            "checklist": [] if status == "no_stories" else contract.get("checklist", []),
            "exit_gate": [] if status == "no_stories" else contract.get("exit_gate", []),
            "forbidden_actions": [] if status == "no_stories" else contract.get("forbidden_actions", []),
            "artifact_workflow": artifact,
        }
    }


def print_text(payload: dict[str, Any], root: Path) -> None:
    launch = payload["launch"]
    if launch["status"] == "no_stories":
        print("no stories")
        return

    print(f"launch: {launch['prompt_path']}")
    print(f"cycle: {launch['cycle']}")
    if launch["story_path"]:
        print(f"story: {launch['story_path']}")
    if launch["stage"] == "cycle":
        print("loop:")
        for item in launch["checklist"]:
            print(f"  - {item}")
    else:
        print("checklist:")
        for index, item in enumerate(launch["checklist"], 1):
            print(f"  {index}) {item}")

    artifact = artifact_workflow(root, launch["stage"], json_format=False)
    if artifact:
        print(artifact)


def main() -> int:
    root = repo_root(Path(__file__))
    contracts = load_stage_contracts(root)
    stages = tuple(contracts.keys())

    parser = argparse.ArgumentParser(description="Launch a Flywheel stage")
    parser.add_argument("stage", nargs="?", choices=stages, default="engineering")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    config = load_config(root)

    if not git_is_repo(root):
        print(f"abort: not a git repository at {root}", file=sys.stderr)
        return 1

    required_branch = get(config, "workflow.required_branch")
    current_branch = git_current_branch(root)
    if current_branch != required_branch:
        print(f"abort: active branch is '{current_branch}'; expected '{required_branch}'", file=sys.stderr)
        return 1

    payload = launch_payload(root, config, contracts, args.stage)
    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print_text(payload, root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
