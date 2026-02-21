import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AthenaError } from "../runtime/errors.js";

const execFileAsync = promisify(execFile);

export async function git(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    throw new AthenaError("SESSION_IO_ERROR", `Git command failed: git ${args.join(" ")}`, false, error);
  }
}

export async function assertGitRepo(repoPath: string): Promise<void> {
  const dotGit = resolve(repoPath, ".git");
  if (!existsSync(dotGit)) {
    // Supports standard repos only for now; worktrees/submodules can be added later.
    throw new AthenaError("CONFIG_ERROR", `Not a git repository (missing .git): ${repoPath}`);
  }
  await git(repoPath, ["rev-parse", "--is-inside-work-tree"]);
}

function normalizeGitPathspecExclude(path: string): string | undefined {
  const normalized = path.replace(/\\/g, "/").replace(/^\.?\//, "").trim();
  if (!normalized) {
    return undefined;
  }
  return `:(exclude)${normalized}`;
}

export async function assertCleanWorktree(repoPath: string, options: { excludePaths?: string[] } = {}): Promise<void> {
  const excludeSpecs = (options.excludePaths ?? [])
    .map((entry) => normalizeGitPathspecExclude(entry))
    .filter((entry): entry is string => typeof entry === "string");
  const { stdout } = await git(repoPath, ["status", "--porcelain", "--", ".", ...excludeSpecs]);
  if (stdout.trim().length > 0) {
    throw new AthenaError("CONFIG_ERROR", `Repository has uncommitted changes; aborting review: ${repoPath}`);
  }
}

export async function resolveBaseRef(options: {
  repoPath: string;
  baseRefFlag?: string;
  defaultBaseRef: string;
  allowAutodetect: boolean;
}): Promise<{ baseRef: string; resolvedFrom: "flag" | "main" | "origin-head" }> {
  if (options.baseRefFlag) {
    return { baseRef: options.baseRefFlag, resolvedFrom: "flag" };
  }

  // Prefer a local `main` branch if present.
  const { repoPath } = options;
  try {
    await git(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${options.defaultBaseRef}`]);
    return { baseRef: options.defaultBaseRef, resolvedFrom: "main" };
  } catch {
    // ignore
  }

  if (!options.allowAutodetect) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `No comparison branch available. Pass --base <branch> (default '${options.defaultBaseRef}' not found).`
    );
  }

  // Use origin/HEAD if available (e.g., trunk/master/main).
  let originHead = "";
  try {
    const { stdout } = await git(repoPath, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
    originHead = stdout.trim();
  } catch {
    originHead = "";
  }

  if (originHead.startsWith("refs/remotes/origin/")) {
    const branchName = originHead.slice("refs/remotes/origin/".length);
    return { baseRef: `origin/${branchName}`, resolvedFrom: "origin-head" };
  }

  throw new AthenaError(
    "CONFIG_ERROR",
    `No comparison branch available. Pass --base <branch> (default '${options.defaultBaseRef}' not found and origin/HEAD not set).`
  );
}

export async function assertRefExists(repoPath: string, ref: string): Promise<void> {
  try {
    await git(repoPath, ["rev-parse", "--verify", "--quiet", ref]);
  } catch {
    throw new AthenaError("CONFIG_ERROR", `Git ref not found: ${ref}`);
  }
}

export async function getDiff(repoPath: string, baseRef: string, headRef: string, maxChars: number): Promise<string> {
  const { stdout } = await git(repoPath, ["diff", "--unified=3", `${baseRef}..${headRef}`]);
  if (stdout.length <= maxChars) {
    return stdout;
  }
  return stdout.slice(0, maxChars) + `\n\n[diff truncated to ${maxChars} chars]\n`;
}

export async function listChangedFiles(repoPath: string, baseRef: string, headRef: string, maxFiles: number): Promise<string[]> {
  const { stdout } = await git(repoPath, ["diff", "--name-only", `${baseRef}..${headRef}`]);
  const files = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return files.slice(0, maxFiles);
}

export async function fileExistsAtRef(repoPath: string, ref: string, filePath: string): Promise<boolean> {
  try {
    await git(repoPath, ["cat-file", "-e", `${ref}:${filePath}`]);
    return true;
  } catch {
    return false;
  }
}

export async function fileSizeAtRef(repoPath: string, ref: string, filePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await git(repoPath, ["cat-file", "-s", `${ref}:${filePath}`]);
    const parsed = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function readFileAtRef(repoPath: string, ref: string, filePath: string, maxChars = 200_000): Promise<string> {
  const { stdout } = await git(repoPath, ["show", `${ref}:${filePath}`]);
  if (stdout.length <= maxChars) {
    return stdout;
  }
  return stdout.slice(0, maxChars) + `\n\n[file truncated to ${maxChars} chars]\n`;
}
