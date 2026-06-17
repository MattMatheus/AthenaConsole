#!/usr/bin/env node
// Guards the hand-written SDK API reference against stale authorization and
// workspace-scope status phrases. Keep this deliberately small; it catches the
// drift patterns that have already misled planning.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const files = execSync("git ls-files 'docs/sdk/api/*.md'", { cwd: repoRoot })
  .toString()
  .split("\n")
  .filter(Boolean);

const forbidden = [
  /no role check enforced/i,
  /no authorizer/i,
  /no Authorized[A-Za-z]+Service/i,
  /client-asserted only/i,
  /there is no membership model/i,
  /no such table exists/i,
  /only scope signal/i
];

const failures = [];

for (const rel of files) {
  const text = readFileSync(resolve(repoRoot, rel), "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const pattern = forbidden.find((candidate) => candidate.test(line));
    if (pattern) {
      failures.push({
        file: rel,
        line: index + 1,
        text: line.trim()
      });
    }
  });
}

if (failures.length > 0) {
  console.error("Found stale SDK API auth/workspace reference text:\n");
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ${failure.text}`);
  }
  console.error("\nUpdate the reference to match services/authorization.ts and auth middleware.");
  process.exit(1);
}

console.log(`Checked SDK API auth/status wording in ${files.length} files. No stale phrases.`);
