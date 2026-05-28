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
FRONTMATTER_RE = re.compile(r"^---\n(?P<body>.*?)\n---\n", re.DOTALL)
FRONTMATTER_STATUS_RE = re.compile(r"^(status:\s*)(.*)$", re.MULTILINE)
QUEUE_ITEM_RE = re.compile(r"^(\s*)\d+\.\s*`([^`]+)`(.*)$")
SECTION_RE = re.compile(r"^##\s+")

QUEUE_SECTIONS = {
    "intake": "## Candidate Sequence",
    "ready": "## Ready Sequence",
    "active": "## Active Sequence",
    "qa": "## QA Sequence",
    "done": "## Completed",
    "blocked": "## Blocked Sequence",
    "archive": "## Archived",
}

EMPTY_MESSAGES = {
    "intake": "No candidate {domain} items.",
    "ready": "No ready {domain} stories.",
    "active": "No active {domain} stories.",
    "qa": "No {domain} stories are waiting for QA.",
    "done": "No completed {domain} stories.",
    "blocked": "No blocked {domain} stories.",
    "archive": "No archived {domain} stories.",
}


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
    updated = STATUS_RE.sub(rf"\g<1>{to_lane}", text, count=1)
    frontmatter = FRONTMATTER_RE.match(updated)
    if not frontmatter:
        return updated

    body = frontmatter.group("body")
    if not FRONTMATTER_STATUS_RE.search(body):
        return updated

    body = FRONTMATTER_STATUS_RE.sub(rf"\g<1>{to_lane}", body, count=1)
    return updated[: frontmatter.start("body")] + body + updated[frontmatter.end("body") :]


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


def queue_item_name(line: str) -> str | None:
    match = QUEUE_ITEM_RE.match(line)
    if not match:
        return None
    return Path(match.group(2)).name


def empty_message(domain: str, lane: str) -> str:
    return EMPTY_MESSAGES.get(lane, "No {domain} stories.").format(domain=domain)


def find_section(lines: list[str], heading: str) -> tuple[int, int] | None:
    for index, line in enumerate(lines):
        if line.strip() == heading:
            end = len(lines)
            for next_index in range(index + 1, len(lines)):
                if SECTION_RE.match(lines[next_index]):
                    end = next_index
                    break
            return index, end
    return None


def normalize_queue_section(lines: list[str], start: int, end: int, domain: str, lane: str) -> None:
    item_number = 1
    has_items = False
    for index in range(start + 1, end):
        match = QUEUE_ITEM_RE.match(lines[index])
        if match:
            lines[index] = f"{match.group(1)}{item_number}. `{match.group(2)}`{match.group(3)}"
            item_number += 1
            has_items = True

    message = empty_message(domain, lane)
    message_indices = [
        index
        for index in range(start + 1, end)
        if lines[index].strip().startswith("No ") and queue_item_name(lines[index]) is None
    ]

    if has_items:
        for index in reversed(message_indices):
            del lines[index]
        return

    del lines[start + 1 : end]
    lines[start + 1 : start + 1] = ["", message, ""]


def remove_queue_item(lines: list[str], item_name: str) -> bool:
    removed = False
    for index in range(len(lines) - 1, -1, -1):
        if queue_item_name(lines[index]) == item_name:
            del lines[index]
            removed = True
    return removed


def add_queue_item(lines: list[str], start: int, end: int, item_name: str) -> None:
    for line in lines[start + 1 : end]:
        if queue_item_name(line) == item_name:
            return

    insert_at = end
    while insert_at > start + 1 and lines[insert_at - 1].strip() == "":
        insert_at -= 1
    lines.insert(insert_at, f"1. `{item_name}`")


def ensure_queue_section(lines: list[str], heading: str) -> tuple[int, int]:
    section = find_section(lines, heading)
    if section:
        return section

    if lines and lines[-1].strip():
        lines.append("")
    lines.extend([heading, ""])
    return len(lines) - 2, len(lines)


def update_lane_readme(root: Path, config: dict, domain: str, lane: str, item_name: str, add: bool) -> str | None:
    lane_dir = path(root, config, f"paths.{domain}.{lane}")
    readme = lane_dir / "README.md"
    if not readme.is_file():
        return None

    original = readme.read_text(encoding="utf-8")
    lines = original.splitlines()
    heading = QUEUE_SECTIONS.get(lane, f"## {lane.title()} Sequence")

    if add:
        start, end = ensure_queue_section(lines, heading)
        add_queue_item(lines, start, end, item_name)
        start, end = find_section(lines, heading) or (start, end + 1)
        normalize_queue_section(lines, start, end, domain, lane)
    else:
        removed = remove_queue_item(lines, item_name)
        section = find_section(lines, heading)
        if section and removed:
            normalize_queue_section(lines, section[0], section[1], domain, lane)

    updated = "\n".join(lines).rstrip() + "\n"
    if updated != original:
        readme.write_text(updated, encoding="utf-8")
        return rel(root, readme)
    return None


def sync_lane_readmes(root: Path, config: dict, domain: str, from_lane: str, to_lane: str, item_name: str) -> list[str]:
    updated = []
    from_readme = update_lane_readme(root, config, domain, from_lane, item_name, add=False)
    if from_readme:
        updated.append(from_readme)
    to_readme = update_lane_readme(root, config, domain, to_lane, item_name, add=True)
    if to_readme:
        updated.append(to_readme)
    return updated


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
    synced_readmes = sync_lane_readmes(root, config, domain, args.from_lane, args.to_lane, source.name)

    return {
        "state_transition": {
            "domain": domain,
            "from_lane": args.from_lane,
            "to_lane": args.to_lane,
            "source_path": rel(root, source),
            "target_path": rel(root, target),
            "history_recorded": not args.no_history,
            "synced_readmes": synced_readmes,
        }
    }


def print_payload(payload: dict, output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(payload, indent=2))
        return
    transition = payload["state_transition"]
    print(f"moved: {transition['source_path']} -> {transition['target_path']}")
    if transition["synced_readmes"]:
        print(f"synced readmes: {', '.join(transition['synced_readmes'])}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage local Flywheel workflow state")
    subparsers = parser.add_subparsers(dest="command", required=True)

    move = subparsers.add_parser("move", help="move an item between lanes and update workflow state")
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
