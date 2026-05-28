#!/usr/bin/env python3
"""Validate local Flywheel workflow state."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from flywheel_config import DOMAINS, LANES, load_config, path, rel, repo_root

METADATA_RE = re.compile(r"^\s*-\s*`(?P<key>[^`]+)`:\s*(?P<value>.*)$")
QUEUE_ITEM_RE = re.compile(r"^\s*\d+\.\s*`([^`]+)`.*$")
FRONTMATTER_RE = re.compile(r"^---\n(?P<body>.*?)\n---\n", re.DOTALL)


class ValidationResult:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.warnings: list[str] = []

    @property
    def ok(self) -> bool:
        return not self.failures

    def fail(self, message: str) -> None:
        self.failures.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def metadata(file_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        for line in file_path.read_text(encoding="utf-8").splitlines():
            match = METADATA_RE.match(line)
            if match:
                values[match.group("key")] = match.group("value").strip()
    except UnicodeDecodeError:
        values["__decode_error__"] = "true"
    return values


def frontmatter(file_path: Path) -> dict[str, str]:
    try:
        text = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return {"__decode_error__": "true"}
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}
    values: dict[str, str] = {}
    for line in match.group("body").splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()
    return values


def has_line(file_path: Path, pattern: str) -> bool:
    regex = re.compile(pattern)
    try:
        return any(regex.search(line) for line in file_path.read_text(encoding="utf-8").splitlines())
    except UnicodeDecodeError:
        return False


def validate_item_file(result: ValidationResult, root: Path, domain: str, lane: str, file_path: Path, seen_ids: dict[str, str]) -> None:
    rel_file = rel(root, file_path)
    base = file_path.name

    if not has_line(file_path, r"^## Metadata$"):
        result.fail(f"missing metadata header ({rel_file})")

    values = metadata(file_path)
    fm = frontmatter(file_path)
    if values.get("__decode_error__") == "true":
        result.fail(f"file is not valid UTF-8 markdown ({rel_file})")
        return

    item_id = values.get("id", "")
    status = values.get("status", "")

    if not item_id:
        result.fail(f"missing metadata id ({rel_file})")
    elif item_id in seen_ids:
        result.fail(f"duplicate id '{item_id}' ({seen_ids[item_id]}, {rel_file})")
    else:
        seen_ids[item_id] = rel_file

    if not status:
        result.fail(f"missing metadata status ({rel_file})")
    elif status not in LANES:
        result.fail(f"invalid metadata status '{status}' ({rel_file})")
    elif status != lane:
            result.fail(f"metadata status '{status}' does not match lane '{lane}' ({rel_file})")

    if not fm:
        result.warn(f"missing YAML frontmatter ({rel_file})")
    else:
        for key in ("kind", "id", "status", "ready"):
            if key not in fm:
                result.warn(f"frontmatter missing '{key}' ({rel_file})")
        if fm.get("id") and item_id and fm["id"] != item_id:
            result.fail(f"frontmatter id does not match metadata id ({rel_file})")
        if fm.get("status") and status and fm["status"] != status:
            result.fail(f"frontmatter status does not match metadata status ({rel_file})")

    if domain == "engineering":
        if base.startswith("STORY-"):
            if not item_id.startswith("STORY-"):
                result.fail(f"story id must start with STORY- ({rel_file})")
        elif base.startswith("BUG-"):
            if not item_id.startswith("BUG-"):
                result.fail(f"bug id must start with BUG- ({rel_file})")
            if values.get("priority", "") not in {"P0", "P1", "P2", "P3"}:
                result.fail(f"bug priority must be P0, P1, P2, or P3 ({rel_file})")
        else:
            result.fail(f"unexpected engineering item filename ({rel_file})")
    elif domain == "architecture":
        if not base.startswith("ARCH-"):
            result.fail(f"unexpected architecture item filename ({rel_file})")
        if not item_id.startswith("ARCH-"):
            result.fail(f"architecture id must start with ARCH- ({rel_file})")

    if domain == "engineering" and lane == "qa":
        validate_engineering_handoff(result, file_path, rel_file)
    if domain == "engineering" and lane == "done":
        validate_engineering_handoff(result, file_path, rel_file)
        validate_qa_verdict(result, file_path, rel_file)
    if domain == "architecture" and lane in {"qa", "done"}:
        validate_architecture_handoff(result, file_path, rel_file)


def section_values(file_path: Path, heading: str) -> dict[str, str]:
    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return {}
    in_section = False
    values: dict[str, str] = {}
    for line in lines:
        if line == heading:
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if in_section:
            match = METADATA_RE.match(line)
            if match:
                values[match.group("key")] = match.group("value").strip()
    return values


def require_filled(result: ValidationResult, values: dict[str, str], key: str, rel_file: str, context: str) -> None:
    if not values.get(key):
        result.fail(f"{context} missing '{key}' ({rel_file})")


def validate_engineering_handoff(result: ValidationResult, file_path: Path, rel_file: str) -> None:
    values = section_values(file_path, "## Engineering Handoff")
    if not values:
        result.fail(f"missing Engineering Handoff section ({rel_file})")
        return
    for key in ("change_summary", "validation_evidence", "qa_focus", "open_risks"):
        require_filled(result, values, key, rel_file, "engineering handoff")


def validate_qa_verdict(result: ValidationResult, file_path: Path, rel_file: str) -> None:
    values = section_values(file_path, "## QA Verdict")
    if not values:
        result.fail(f"missing QA Verdict section ({rel_file})")
        return
    for key in ("verdict", "evidence_quality", "state_transition"):
        require_filled(result, values, key, rel_file, "qa verdict")


def validate_architecture_handoff(result: ValidationResult, file_path: Path, rel_file: str) -> None:
    values = section_values(file_path, "## Architecture Handoff")
    if not values:
        result.fail(f"missing Architecture Handoff section ({rel_file})")
        return
    for key in ("decision_summary", "alternatives_considered", "operational_impact", "follow_on_work"):
        require_filled(result, values, key, rel_file, "architecture handoff")


def validate_active_queue(result: ValidationResult, root: Path, domain: str, active_dir: Path) -> None:
    queue_file = active_dir / "README.md"
    if not queue_file.exists():
        return

    listed: set[str] = set()
    for line in queue_file.read_text(encoding="utf-8").splitlines():
        match = QUEUE_ITEM_RE.match(line)
        if not match:
            continue
        raw = match.group(1)
        queue_path = Path(raw)
        if not queue_path.is_absolute():
            queue_path = active_dir / queue_path
        rel_path = rel(root, queue_path)
        listed.add(rel_path)
        listed.add(queue_path.name)
        if not queue_path.is_file():
            result.fail(f"active queue references missing file ({rel_path})")

    active_files = sorted(item for item in active_dir.glob("*.md") if item.name != "README.md" and item.is_file())
    if active_files and not listed:
        result.warn(f"{domain} active lane contains items but README.md has no explicit Active Sequence entries")
        return

    for item in active_files:
        rel_path = rel(root, item)
        if rel_path not in listed and item.name not in listed:
            result.warn(f"{domain} active item is not listed in Active Sequence ({rel_path})")


def validate(root: Path) -> ValidationResult:
    config = load_config(root)
    result = ValidationResult()
    seen_ids: dict[str, str] = {}

    for domain in DOMAINS:
        for lane in LANES:
            key = f"paths.{domain}.{lane}"
            try:
                lane_dir = path(root, config, key)
            except (KeyError, TypeError) as exc:
                result.fail(f"invalid config for {key}: {exc}")
                continue

            if not lane_dir.is_dir():
                result.fail(f"missing lane directory ({rel(root, lane_dir)})")
                continue

            for file_path in sorted(lane_dir.glob("*.md")):
                if file_path.name == "README.md":
                    continue
                validate_item_file(result, root, domain, lane, file_path, seen_ids)

        try:
            active_dir = path(root, config, f"paths.{domain}.active")
        except (KeyError, TypeError):
            continue
        if active_dir.is_dir():
            validate_active_queue(result, root, domain, active_dir)

    return result


def print_text(result: ValidationResult) -> None:
    if result.ok:
        for warning in result.warnings:
            print(f"WARN: {warning}")
        print("PASS: workflow state validation")
        return

    for failure in result.failures:
        print(f"FAIL: {failure}", file=sys.stderr)
    for warning in result.warnings:
        print(f"WARN: {warning}")


def print_json(result: ValidationResult) -> None:
    print(json.dumps({"workflow_state": {"status": "pass" if result.ok else "fail", "failures": result.failures, "warnings": result.warnings}}, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate local Flywheel workflow state")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    try:
        result = validate(repo_root(Path(__file__)))
    except Exception as exc:
        result = ValidationResult()
        result.fail(str(exc))

    print_json(result) if args.format == "json" else print_text(result)
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
