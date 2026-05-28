#!/usr/bin/env python3
"""Run local health checks for the Flywheel harness."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from flywheel_config import load_config, repo_root
from stage_context import load_stage_contracts
from validate_workflow_state import validate

REQUIRED_FILES = (
    "flywheel.yaml",
    "flywheel/README.md",
    "flywheel/AGENTS.md",
    "flywheel/HUMANS.md",
    "flywheel/DEVELOPMENT_CYCLE.md",
    "flywheel/CONFIG_SCHEMA.md",
    "flywheel/stage_contracts.yaml",
    "flywheel/tools/README.md",
    "flywheel/tools/launch_stage.sh",
    "flywheel/tools/validate_workflow_state.sh",
    "flywheel/tools/flywheel_state.sh",
    "flywheel/tools/flywheel_approval.sh",
    "flywheel/tools/run_observer_cycle.sh",
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Flywheel harness health")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    root = repo_root(Path(__file__))
    failures: list[str] = []
    warnings: list[str] = []

    for required in REQUIRED_FILES:
        if not (root / required).exists():
            failures.append(f"missing required file: {required}")

    try:
        load_config(root)
    except Exception as exc:
        failures.append(f"config load failed: {exc}")

    try:
        contracts = load_stage_contracts(root)
        for stage in ("planning", "architect", "engineering", "qa", "pm", "cycle"):
            if stage not in contracts:
                failures.append(f"stage contract missing: {stage}")
    except Exception as exc:
        failures.append(f"stage contracts load failed: {exc}")

    try:
        workflow = validate(root)
        failures.extend(workflow.failures)
        warnings.extend(workflow.warnings)
    except Exception as exc:
        failures.append(f"workflow validation failed: {exc}")

    payload = {
        "flywheel_doctor": {
            "status": "pass" if not failures else "fail",
            "failures": failures,
            "warnings": warnings,
        }
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        for failure in failures:
            print(f"FAIL: {failure}")
        for warning in warnings:
            print(f"WARN: {warning}")
        if not failures:
            print("PASS: flywheel doctor")

    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
