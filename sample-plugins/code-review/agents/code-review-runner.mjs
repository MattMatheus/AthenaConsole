import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, isAbsolute, resolve } from "node:path";
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const execFileAsync = promisify(execFile);

const inputContract = {
  repo: {
    type: "object",
    required: true
  },
  baseRef: {
    type: "string",
    default: "main"
  },
  headRef: {
    type: "string",
    default: "HEAD"
  },
  maxFiles: {
    type: "integer",
    default: 100
  },
  maxPatchBytes: {
    type: "integer",
    default: 60000
  }
};

const SOURCE_FILE_PATTERN = /\.(c|cc|cpp|cs|go|java|js|jsx|kt|mjs|php|py|rb|rs|swift|ts|tsx)$/i;
const TEST_FILE_PATTERN = /(^|\/)(__tests__|tests?|spec|test)(\/|\.|-|_)|(\.test|\.spec)\.[cm]?[jt]sx?$/i;
const LOCKFILE_NAMES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb"]);
const SECRET_ENV_PATTERN = /(^|\/)\.env(\.|$)/;

try {
  const stdin = await readStdin();
  const envelope = parseAgentTaskRunEnvelope(stdin);
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const request = readReviewRequest(inputs);
  const review = await reviewDiff(request);
  const markdown = renderMarkdown(review);
  const artifact = createAgentArtifact({
    id: `code-review-${envelope.run.id}`,
    label: `Code review: ${review.repoName}`,
    kind: "primary",
    format: "markdown",
    storageUri: `memory://code-review/${encodeURIComponent(envelope.run.id)}/report.md`,
    metadata: {
      repoPath: review.repoPath,
      baseRef: review.baseRef,
      headRef: review.headRef,
      findingCount: review.findings.length,
      deterministic: true,
      readOnly: true
    }
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          status: review.findings.some((finding) => finding.priority === "P1") ? "needs-attention" : "reviewed",
          repo: {
            name: review.repoName,
            path: review.repoPath
          },
          baseRef: review.baseRef,
          headRef: review.headRef,
          findings: review.findings,
          changedFiles: review.changedFiles,
          metrics: review.metrics,
          summaryMarkdown: markdown
        },
        {
          artifacts: [artifact]
        }
      )
    )
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function readStdin() {
  let body = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  return body;
}

function readReviewRequest(inputs) {
  const repo = readRepoInput(inputs.repo);
  return {
    repoPath: repo.path,
    baseRef: readStringInput(inputs.baseRef, "main"),
    headRef: readStringInput(inputs.headRef, "HEAD"),
    maxFiles: clampInteger(inputs.maxFiles, 1, 1000, 100),
    maxPatchBytes: clampInteger(inputs.maxPatchBytes, 1000, 500000, 60000)
  };
}

function readRepoInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("inputs.repo must be an object.");
  }
  const path = value.path;
  if (typeof path !== "string" || path.trim().length === 0) {
    throw new Error("inputs.repo.path must be a non-empty string.");
  }
  return {
    path: isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path)
  };
}

function readStringInput(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

async function reviewDiff(request) {
  await git(request.repoPath, ["rev-parse", "--is-inside-work-tree"]);
  const diffRange = `${request.baseRef}..${request.headRef}`;
  const fileOutput = await git(request.repoPath, ["diff", "--name-only", diffRange, "--"]);
  const allChangedFiles = fileOutput
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const changedFiles = allChangedFiles.slice(0, request.maxFiles);
  const fileListTruncated = allChangedFiles.length > changedFiles.length;
  const numstatOutput = await git(request.repoPath, ["diff", "--numstat", diffRange, "--"]);
  const stats = parseNumstat(numstatOutput);
  const patch = await readBoundedPatch(request.repoPath, diffRange, request.maxPatchBytes);
  const findings = buildFindings({
    changedFiles,
    fileListTruncated,
    stats,
    patch,
    maxPatchBytes: request.maxPatchBytes
  });

  return {
    repoName: basename(request.repoPath),
    repoPath: request.repoPath,
    baseRef: request.baseRef,
    headRef: request.headRef,
    changedFiles,
    findings,
    metrics: {
      changedFileCount: allChangedFiles.length,
      scannedFileCount: changedFiles.length,
      additions: stats.reduce((sum, entry) => sum + entry.additions, 0),
      deletions: stats.reduce((sum, entry) => sum + entry.deletions, 0),
      patchBytes: Buffer.byteLength(patch.body, "utf8"),
      patchTruncated: patch.truncated,
      fileListTruncated
    }
  };
}

async function git(repoPath, args, options = {}) {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      maxBuffer: options.maxBuffer ?? 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = typeof error?.stderr === "string" && error.stderr.trim() ? `: ${error.stderr.trim()}` : "";
    throw new Error(`git ${args.join(" ")} failed${stderr || `: ${message}`}`);
  }
}

function parseNumstat(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [additions, deletions, ...pathParts] = line.split("\t");
      return {
        path: pathParts.join("\t"),
        additions: parseStatNumber(additions),
        deletions: parseStatNumber(deletions)
      };
    });
}

function parseStatNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readBoundedPatch(repoPath, diffRange, maxPatchBytes) {
  const stdout = await git(repoPath, ["diff", "--unified=3", diffRange, "--"], {
    maxBuffer: maxPatchBytes + 65536
  });
  if (Buffer.byteLength(stdout, "utf8") <= maxPatchBytes) {
    return {
      body: stdout,
      truncated: false
    };
  }
  return {
    body: stdout.slice(0, maxPatchBytes),
    truncated: true
  };
}

function buildFindings({ changedFiles, fileListTruncated, stats, patch, maxPatchBytes }) {
  const findings = [];
  const changedFileSet = new Set(changedFiles);
  const sourceFiles = changedFiles.filter((file) => SOURCE_FILE_PATTERN.test(file));
  const testFiles = changedFiles.filter((file) => TEST_FILE_PATTERN.test(file));

  for (const file of changedFiles) {
    if (SECRET_ENV_PATTERN.test(file) && !file.endsWith(".example")) {
      findings.push({
        priority: "P1",
        category: "security",
        file,
        title: "Environment file changed",
        detail: "The diff includes an environment file. Verify no secrets or local-only credentials are being committed.",
        confidence: 0.92
      });
    }
  }

  if (changedFileSet.has("package.json") && !changedFiles.some((file) => LOCKFILE_NAMES.has(file))) {
    findings.push({
      priority: "P2",
      category: "correctness",
      file: "package.json",
      title: "Package manifest changed without lockfile update",
      detail: "Dependency or script changes should usually carry the matching lockfile update so installs remain deterministic.",
      confidence: 0.84
    });
  }

  if (sourceFiles.length > 0 && testFiles.length === 0) {
    findings.push({
      priority: "P2",
      category: "test-gaps",
      file: sourceFiles[0],
      title: "Source changes have no companion test updates",
      detail: "The branch changes source files but no obvious test files. Add or update focused tests for reliability-sensitive behavior.",
      confidence: 0.76
    });
  }

  const consoleLogFile = findAddedLineFile(patch.body, /^\+\s*console\.log\(/);
  if (consoleLogFile) {
    findings.push({
      priority: "P3",
      category: "maintainability",
      file: consoleLogFile,
      title: "Debug logging added",
      detail: "The diff adds console.log output. Confirm this is intentional product logging or replace it with the project logging path.",
      confidence: 0.81
    });
  }

  const todoFile = findAddedLineFile(patch.body, /^\+.*\b(TODO|FIXME)\b/i);
  if (todoFile) {
    findings.push({
      priority: "P3",
      category: "maintainability",
      file: todoFile,
      title: "Deferred work marker added",
      detail: "The diff adds TODO/FIXME text. Make the follow-up explicit in the backlog or resolve it before merging.",
      confidence: 0.72
    });
  }

  if (patch.truncated) {
    findings.push({
      priority: "P2",
      category: "maintainability",
      file: changedFiles[0] ?? "(diff)",
      title: "Patch scan was truncated",
      detail: `The diff exceeded ${maxPatchBytes} bytes, so the reviewer inspected a bounded prefix. Split the change or run a deeper review.`,
      confidence: 0.9
    });
  }

  if (fileListTruncated) {
    findings.push({
      priority: "P2",
      category: "maintainability",
      file: changedFiles[changedFiles.length - 1] ?? "(files)",
      title: "Changed file list was truncated",
      detail: "The branch changed more files than this sample was asked to scan. Increase maxFiles or split the review.",
      confidence: 0.9
    });
  }

  if (findings.length === 0 && stats.length > 0) {
    findings.push({
      priority: "P3",
      category: "review",
      file: changedFiles[0] ?? "(diff)",
      title: "No heuristic issues detected",
      detail: "The deterministic sample checks did not identify a concrete issue. Human review is still recommended for behavior and design intent.",
      confidence: 0.62
    });
  }

  return findings;
}

function findAddedLineFile(patch, pattern) {
  let currentFile;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length);
      continue;
    }
    if (pattern.test(line)) {
      return currentFile;
    }
  }
  return undefined;
}

function renderMarkdown(review) {
  const findings =
    review.findings.length > 0
      ? review.findings
          .map(
            (finding) =>
              `- ${finding.priority} ${finding.category}: ${finding.title} (${finding.file})\n  ${finding.detail}\n  Confidence: ${finding.confidence}`
          )
          .join("\n")
      : "- No findings";
  const files = review.changedFiles.length > 0 ? review.changedFiles.map((file) => `- ${file}`).join("\n") : "- No changed files";

  return [
    `# Code Review: ${review.repoName}`,
    "",
    `Range: \`${review.baseRef}..${review.headRef}\``,
    `Path: \`${review.repoPath}\``,
    "",
    "## Summary",
    "",
    `- Changed files: ${review.metrics.changedFileCount}`,
    `- Scanned files: ${review.metrics.scannedFileCount}`,
    `- Additions: ${review.metrics.additions}`,
    `- Deletions: ${review.metrics.deletions}`,
    `- Patch truncated: ${review.metrics.patchTruncated ? "yes" : "no"}`,
    "",
    "## Findings",
    "",
    findings,
    "",
    "## Changed Files",
    "",
    files
  ].join("\n");
}
