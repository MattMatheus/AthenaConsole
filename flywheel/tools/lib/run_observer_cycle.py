#!/usr/bin/env python3
"""Write observer markdown and structured JSON trace artifacts."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flywheel_config import artifact_name, feature_enabled, git_current_branch, load_config, path, rel, repo_root, template_path


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git_lines(root: Path, args: list[str]) -> list[str]:
    output = subprocess.check_output(["git", "-C", str(root), *args], text=True)
    return [line for line in output.splitlines() if line.strip()]


def diff_inventory(root: Path) -> list[str]:
    rows: set[str] = set()
    for line in git_lines(root, ["diff", "--cached", "--name-status"]):
        rows.add(line)
    for line in git_lines(root, ["diff", "--name-status"]):
        rows.add(line)
    for line in git_lines(root, ["ls-files", "--others", "--exclude-standard"]):
        rows.add(f"A\t{line}")
    return sorted(rows)


def trace_payload(root: Path, config: dict[str, Any], cycle_id: str, story_path: str) -> dict[str, Any]:
    generated_at = utc_now()
    story_rel = rel(root, root / story_path) if story_path else ""
    return {
        "cycle_id": cycle_id,
        "generated_at_utc": generated_at,
        "branch": git_current_branch(root),
        "story_path": story_rel,
        "actor": "",
        "stage_trace": [],
        "diff_inventory": diff_inventory(root),
        "objective": {
            "intended_outcome": "",
            "scope_boundary": "",
        },
        "inputs_and_evidence": {
            "artifacts_reviewed": [],
            "tools_used": [],
            "external_sources": [],
        },
        "changes_made": {
            "files_changed": [],
            "state_transitions": [],
            "non_file_actions": [],
        },
        "validation": {
            "checks_run": [],
            "results": [],
            "checks_not_run": [],
        },
        "workflow_sync_checks": {
            "entry_docs_updated_if_workflow_changed": False,
            "prompts_updated_if_stage_behavior_changed": False,
            "process_docs_updated_if_contracts_or_gates_changed": False,
            "queue_order_and_state_synchronized": False,
        },
        "warnings_and_risks": {
            "unresolved_risks": [],
            "assumptions_carried": [],
            "warnings": [],
        },
        "action_record": {
            "highest_action_class": "",
            "approval_required": "",
            "approval_reference": "",
        },
        "next_step": {
            "recommended_next_state": "",
            "follow_up_work": [],
            "durable_promotions": [],
        },
        "release_impact": {
            "release_scope": "",
            "additional_release_actions": [],
        },
    }


def write_markdown(report_path: Path, trace: dict[str, Any]) -> None:
    diff_rows = trace["diff_inventory"] or ["no tracked or untracked file deltas detected"]
    lines = [
        f"# Observer Report: {trace['cycle_id']}",
        "",
        "## Metadata",
        f"- `cycle_id`: {trace['cycle_id']}",
        f"- `generated_at_utc`: {trace['generated_at_utc']}",
        f"- `branch`: {trace['branch']}",
        f"- `story_path`: {trace['story_path']}",
        f"- `actor`: {trace['actor']}",
        "",
        "## Structured Trace",
        f"- `trace_path`: {report_path.with_suffix('.json').name}",
        "",
        "## Stage Trace",
        "- `events`: []",
        "",
        "## Diff Inventory",
    ]
    lines.extend(f"- {row}" for row in diff_rows)
    lines.extend([
        "",
        "## Objective",
        "- `intended_outcome`: ",
        "- `scope_boundary`: ",
        "",
        "## Inputs And Evidence",
        "- `artifacts_reviewed`: []",
        "- `tools_used`: []",
        "- `external_sources`: []",
        "",
        "## Changes Made",
        "- `files_changed`: []",
        "- `state_transitions`: []",
        "- `non_file_actions`: []",
        "",
        "## Validation",
        "- `checks_run`: []",
        "- `results`: []",
        "- `checks_not_run`: []",
        "",
        "## Workflow Sync Checks",
        "- [ ] Entry docs updated if workflow behavior changed.",
        "- [ ] Prompts updated if stage behavior changed.",
        "- [ ] Process docs updated if contracts or gates changed.",
        "- [ ] Queue order and state remain synchronized.",
        "",
        "## Warnings And Risks",
        "- `unresolved_risks`: []",
        "- `assumptions_carried`: []",
        "- `warnings`: []",
        "",
        "## Action Record",
        "- `highest_action_class`: ",
        "- `approval_required`: ",
        "- `approval_reference`: ",
        "",
        "## Next Step",
        "- `recommended_next_state`: ",
        "- `follow_up_work`: []",
        "- `durable_promotions`: []",
        "",
        "## Release Impact",
        "- Release scope: ",
        "- Additional release actions: []",
        "",
    ])
    report_path.write_text("\n".join(lines), encoding="utf-8")


def artifact_workflow(root: Path, config: dict[str, Any], cycle_id: str) -> str:
    if not feature_enabled(config, "integrations.artifact_workflow.enabled"):
        return ""
    script = root / "flywheel" / "tools" / "artifact_workflow.sh"
    return subprocess.check_output([str(script), "observer", "--cycle-id", cycle_id], text=True).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Write a Flywheel observer report")
    parser.add_argument("--cycle-id", required=True)
    parser.add_argument("--story", default="")
    parser.add_argument("--output", default="")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    root = repo_root(Path(__file__))
    config = load_config(root)
    observer_dir = path(root, config, "paths.artifacts.observer")
    observer_dir.mkdir(parents=True, exist_ok=True)

    if args.output:
        report_path = Path(args.output)
        if not report_path.is_absolute():
            report_path = root / report_path
    else:
        report_path = observer_dir / artifact_name(config, "observer_report_pattern", cycle_id=args.cycle_id)

    trace_path = report_path.with_suffix(".json")
    trace = trace_payload(root, config, args.cycle_id, args.story)
    write_markdown(report_path, trace)
    trace_path.write_text(json.dumps(trace, indent=2) + "\n", encoding="utf-8")

    artifact_output = artifact_workflow(root, config, args.cycle_id)
    payload = {"observer": {"report_path": rel(root, report_path), "trace_path": rel(root, trace_path), "artifact_workflow": artifact_output or None}}

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print(f"wrote: {payload['observer']['report_path']}")
        print(f"wrote: {payload['observer']['trace_path']}")
        if artifact_output:
            print(artifact_output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
