#!/usr/bin/env python3
"""Record explicit approvals for risky or sensitive Flywheel actions."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from flywheel_config import load_config, path, rel, repo_root

SLUG_RE = re.compile(r"[^a-zA-Z0-9._-]+")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def slugify(value: str) -> str:
    cleaned = SLUG_RE.sub("-", value.strip()).strip("-.").lower()
    return cleaned or "approval"


def main() -> int:
    parser = argparse.ArgumentParser(description="Record a Flywheel approval event")
    parser.add_argument("record", choices=("record",))
    parser.add_argument("--action-class", required=True, choices=("risky-write", "sensitive-or-production"))
    parser.add_argument("--summary", required=True)
    parser.add_argument("--approved-by", required=True)
    parser.add_argument("--scope", default="")
    parser.add_argument("--risks", default="")
    parser.add_argument("--conditions", default="")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    root = repo_root(Path(__file__))
    config = load_config(root)
    observer_dir = path(root, config, "paths.artifacts.observer")
    approvals_dir = observer_dir / "approvals"
    approvals_dir.mkdir(parents=True, exist_ok=True)

    timestamp = utc_now()
    filename = f"APPROVAL-{timestamp[:10]}-{slugify(args.summary)}.json"
    approval_path = approvals_dir / filename
    payload = {
        "approval": {
            "recorded_at_utc": timestamp,
            "action_class": args.action_class,
            "summary": args.summary,
            "approved_by": args.approved_by,
            "scope": args.scope,
            "risks": args.risks,
            "conditions": args.conditions,
        }
    }
    approval_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    output = {"approval_record": {"path": rel(root, approval_path), **payload["approval"]}}
    if args.format == "json":
        print(json.dumps(output, indent=2))
    else:
        print(f"wrote: {output['approval_record']['path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
