#!/usr/bin/env python3
"""Move Flywheel items through local workflow lanes."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from flywheel_config import DOMAINS, LANES, load_config, path, rel, repo_root

STATUS_RE = re.compile(r"^(\s*-\s*`status`:\s*)(.*)$", re.MULTILINE)
ID_RE = re.compile(r"^\s*-\s*`id`:\s*(.*)$", re.MULTILINE)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def infer_domain(item: str, domain: str | None) -> str:
    if domain:
        return domain
    name = Path(item).name
    if name.startswith("ARCH-"):
        return "architecture"
    return "engineering"


def item_id_from_text(text: str) -> str:
    match = ID_RE.search(text)
    return match.group(1).strip() if match else ""


def find_item(root: Path, config: dict, domain: str, lane: str, item: str) -> Path:
    candidate = Path(item)
    if candidate.is_file():
        return candidate
    if not candidate.is_absolute() and (root / candidate).is_file():
        return root / candidate

    lane_dir = path(root, config, f"paths.{domain}.{lane}")
    name = Path(item).name
    candidates = []
    if (lane_dir / name).is_file():
        candidates.append(lane_dir / name)
    if not name.endswith(".md") and (lane_dir / f"{name}.md").is_file():
        candidates.append(lane_dir / f"{name}.md")

    for file_path in sorted(lane_dir.glob("*.md")):
        if file_path.name == "README.md":
            continue
        text = file_path.read_text(encoding="utf-8")
        if item_id_from_text(text) == item:
            candidates.append(file_path)

    unique = []
    for found in candidates:
        if found not in unique:
            unique.append(found)

    if not unique:
        raise RuntimeError(f"item '{item}' not found in {domain}.{lane}")
    if len(unique) > 1:
        raise RuntimeError(f"item '{item}' matched multiple files: {', '.join(rel(root, item) for item in unique)}")
    return unique[0]


def update_status(text: str, to_lane: str) -> str:
    if not STATUS_RE.search(text):
        raise RuntimeError("item is missing metadata status line")
    return STATUS_RE.sub(rf"\g<1>{to_lane}", text, count=1)


def append_transition(text: str, from_lane: str, to_lane: str, actor: str, reason: str) -> str:
    note = f"- `{utc_now()}`: `{from_lane}` -> `{to_lane}`"
    if actor:
        note += f" by `{actor}`"
    if reason:
        note += f"; {reason}"
    note += "\n"

    section = "## Transition History"
    if section not in text:
        return text.rstrip() + "\n\n" + section + "\n" + note
    return text.rstrip() + "\n" + note


def move_item(args: argparse.Namespace) -> dict:
    root = repo_root(Path(__file__))
    config = load_config(root)
    domain = infer_domain(args.item, args.domain)

    if args.from_lane not in LANES or args.to_lane not in LANES:
        raise RuntimeError(f"lanes must be one of: {', '.join(LANES)}")
    if domain not in DOMAINS:
        raise RuntimeError(f"domain must be one of: {', '.join(DOMAINS)}")

    source = find_item(root, config, domain, args.from_lane, args.item)
    target_dir = path(root, config, f"paths.{domain}.{args.to_lane}")
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / source.name
    if target.exists():
        raise RuntimeError(f"target already exists: {rel(root, target)}")

    original = source.read_text(encoding="utf-8")
    updated = update_status(original, args.to_lane)
    if not args.no_history:
        updated = append_transition(updated, args.from_lane, args.to_lane, args.actor, args.reason)

    temp = source.with_suffix(source.suffix + ".tmp")
    temp.write_text(updated, encoding="utf-8")
    shutil.move(str(temp), str(target))
    source.unlink()

    return {
        "state_transition": {
            "domain": domain,
            "from_lane": args.from_lane,
            "to_lane": args.to_lane,
            "source_path": rel(root, source),
            "target_path": rel(root, target),
            "history_recorded": not args.no_history,
        }
    }


def print_payload(payload: dict, output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(payload, indent=2))
        return
    transition = payload["state_transition"]
    print(f"moved: {transition['source_path']} -> {transition['target_path']}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage local Flywheel workflow state")
    subparsers = parser.add_subparsers(dest="command", required=True)

    move = subparsers.add_parser("move", help="move an item between lanes and update metadata status")
    move.add_argument("item", help="item path, filename, or metadata id")
    move.add_argument("from_lane", choices=LANES)
    move.add_argument("to_lane", choices=LANES)
    move.add_argument("--domain", choices=DOMAINS)
    move.add_argument("--reason", default="")
    move.add_argument("--actor", default="")
    move.add_argument("--no-history", action="store_true")
    move.add_argument("--format", choices=("text", "json"), default="text")

    args = parser.parse_args()
    try:
        if args.command == "move":
            payload = move_item(args)
        else:
            raise RuntimeError(f"unsupported command: {args.command}")
        print_payload(payload, args.format)
        return 0
    except Exception as exc:
        if getattr(args, "format", "text") == "json":
            print(json.dumps({"error": str(exc)}, indent=2))
        else:
            print(f"error: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
