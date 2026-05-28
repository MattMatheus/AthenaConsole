#!/usr/bin/env python3
"""Shared Flywheel configuration and repository helpers."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - operator-facing fallback
    yaml = None


LANES = ("intake", "ready", "active", "qa", "done", "blocked", "archive")
DOMAINS = ("engineering", "architecture")


def repo_root(start: Path | None = None) -> Path:
    anchor = (start or Path(__file__)).resolve()
    search_dir = anchor if anchor.is_dir() else anchor.parent
    try:
        output = subprocess.check_output(
            ["git", "-C", str(search_dir), "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        return Path(output)
    except subprocess.CalledProcessError:
        return Path(__file__).resolve().parents[3]


def config_file(root: Path | None = None) -> Path:
    return (root or repo_root()) / "flywheel.yaml"


def load_config(root: Path | None = None) -> dict[str, Any]:
    path = config_file(root)
    if yaml is None:
        raise RuntimeError("PyYAML is required for Flywheel Python tools")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise RuntimeError("flywheel.yaml must contain a mapping")
    return data


def get(config: dict[str, Any], dotted_key: str) -> Any:
    value: Any = config
    for part in dotted_key.split("."):
        if not isinstance(value, dict) or part not in value:
            raise KeyError(dotted_key)
        value = value[part]
    return value


def get_optional(config: dict[str, Any], dotted_key: str, default: Any = None) -> Any:
    try:
        return get(config, dotted_key)
    except KeyError:
        return default


def feature_enabled(config: dict[str, Any], dotted_key: str) -> bool:
    return get_optional(config, dotted_key, False) is True


def path(root: Path, config: dict[str, Any], dotted_key: str) -> Path:
    value = get(config, dotted_key)
    if not isinstance(value, str):
        raise TypeError(f"{dotted_key} must be a string path")
    return root / value


def template_path(root: Path, config: dict[str, Any], template_key: str) -> Path:
    templates_dir = path(root, config, "paths.templates")
    template_name = get(config, f"templates.{template_key}")
    if not isinstance(template_name, str):
        raise TypeError(f"templates.{template_key} must be a string filename")
    return templates_dir / template_name


def artifact_name(config: dict[str, Any], pattern_key: str, **tokens: str) -> str:
    pattern = get(config, f"artifacts.{pattern_key}")
    if not isinstance(pattern, str):
        raise TypeError(f"artifacts.{pattern_key} must be a string pattern")
    for key, value in tokens.items():
        pattern = pattern.replace("{" + key + "}", value)
    return pattern


def rel(root: Path, value: Path | str) -> str:
    path_value = Path(value)
    try:
        return str(path_value.relative_to(root))
    except ValueError:
        return str(path_value)


def git_current_branch(root: Path) -> str:
    return subprocess.check_output(
        ["git", "-C", str(root), "branch", "--show-current"],
        text=True,
    ).strip()


def git_is_repo(root: Path) -> bool:
    try:
        subprocess.check_call(
            ["git", "-C", str(root), "rev-parse", "--is-inside-work-tree"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        return False
