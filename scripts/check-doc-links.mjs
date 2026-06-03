#!/usr/bin/env node
// Verifies that relative markdown links in tracked *.md files resolve to a real
// file on disk. Guards against the doc drift that accumulates when files are
// moved or deleted but their links are left behind.
//
// Scope: clickable markdown links of the form `](target)`. External links
// (http/https/mailto), pure anchors, and absolute paths are skipped. Inline
// backtick path citations are intentionally NOT checked: many are historical
// references to deliberately removed files and need human judgment.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const files = execSync("git ls-files '*.md'", { cwd: repoRoot })
  .toString()
  .split("\n")
  .filter(Boolean);

const LINK_RE = /\]\(([^)]+)\)/g;
const SKIP_PREFIX = ["http://", "https://", "mailto:", "//", "#"];

const broken = [];

for (const rel of files) {
  const abs = resolve(repoRoot, rel);
  const dir = dirname(abs);
  const text = readFileSync(abs, "utf8");
  for (const match of text.matchAll(LINK_RE)) {
    const raw = match[1].trim();
    if (!raw || SKIP_PREFIX.some((p) => raw.startsWith(p))) continue;
    if (raw.includes("://")) continue;
    // Drop anchor / query suffixes before resolving.
    const target = raw.split("#")[0].split("?")[0].trim();
    if (!target) continue;
    // Absolute-from-root style links are not relative file references.
    if (target.startsWith("/")) continue;
    const resolved = resolve(dir, target);
    if (!existsSync(resolved)) {
      broken.push({ source: rel, link: raw });
    }
  }
}

if (broken.length > 0) {
  console.error(`Found ${broken.length} broken relative markdown link(s):\n`);
  for (const b of broken) {
    console.error(`  ${b.source}  ->  ${b.link}`);
  }
  console.error("\nFix the link target, or update it if the file moved.");
  process.exit(1);
}

console.log(`Checked relative markdown links in ${files.length} files. No broken links.`);
