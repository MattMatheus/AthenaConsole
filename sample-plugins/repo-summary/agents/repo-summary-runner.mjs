import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  repo: {
    type: "object",
    required: true
  },
  maxFiles: {
    type: "integer",
    default: 200
  }
};

const EXCLUDED_DIRS = new Set([".git", ".hg", ".svn", "node_modules", "dist", "build", ".next", ".turbo", "coverage"]);
const README_NAMES = new Set(["README.md", "README.markdown", "README.txt", "README"]);
const INTERESTING_NAMES = new Set([
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "requirements.txt",
  "AGENTS.md",
  "Dockerfile",
  "docker-compose.yml",
  "compose.yml"
]);

try {
  const stdin = await readStdin();
  const envelope = parseAgentTaskRunEnvelope(stdin);
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const repo = readRepoInput(inputs.repo);
  const maxFiles = clampMaxFiles(inputs.maxFiles);
  const summary = await summarizeRepo(repo.path, maxFiles);
  const markdown = renderMarkdown(summary);
  const artifact = createAgentArtifact({
    id: `repo-summary-${envelope.run.id}`,
    label: `Repo summary: ${summary.name}`,
    kind: "primary",
    format: "markdown",
    storageUri: `memory://repo-summary/${encodeURIComponent(envelope.run.id)}/summary.md`,
    metadata: {
      repoPath: summary.path,
      fileCount: summary.fileCount,
      scannedFileCount: summary.scannedFileCount,
      truncated: summary.truncated,
      deterministic: true,
      readOnly: true
    }
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          repo: {
            name: summary.name,
            path: summary.path
          },
          fileCount: summary.fileCount,
          scannedFileCount: summary.scannedFileCount,
          topLanguages: summary.languages.slice(0, 8),
          notableFiles: summary.notableFiles,
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

function clampMaxFiles(value) {
  if (!Number.isInteger(value)) {
    return 200;
  }
  return Math.min(1000, Math.max(1, value));
}

async function summarizeRepo(repoPath, maxFiles) {
  const rootStat = await stat(repoPath);
  if (!rootStat.isDirectory()) {
    throw new Error(`inputs.repo.path must point to a directory: ${repoPath}`);
  }

  const files = [];
  await collectFiles(repoPath, repoPath, files, maxFiles);
  const languagesByKey = new Map();
  const notableFiles = [];
  let readmeExcerpt;

  for (const file of files) {
    const name = basename(file);
    const relativePath = relative(repoPath, file);
    const key = languageKey(relativePath);
    languagesByKey.set(key, (languagesByKey.get(key) ?? 0) + 1);
    if (README_NAMES.has(name)) {
      readmeExcerpt = await readExcerpt(file);
    }
    if (INTERESTING_NAMES.has(name) || README_NAMES.has(name)) {
      notableFiles.push(relativePath);
    }
  }

  const languages = Array.from(languagesByKey.entries())
    .map(([language, count]) => ({ language, count }))
    .sort((left, right) => right.count - left.count || left.language.localeCompare(right.language));

  return {
    name: basename(repoPath),
    path: repoPath,
    fileCount: files.length,
    scannedFileCount: files.length,
    truncated: files.length >= maxFiles,
    languages,
    notableFiles: notableFiles.slice(0, 20),
    readmeExcerpt
  };
}

async function collectFiles(root, dir, files, maxFiles) {
  if (files.length >= maxFiles) {
    return;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (files.length >= maxFiles) {
      return;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await collectFiles(root, path, files, maxFiles);
      }
      continue;
    }
    if (entry.isFile()) {
      files.push(path);
    }
  }
}

async function readExcerpt(path) {
  const raw = await readFile(path, "utf8");
  return raw.replace(/\s+/g, " ").trim().slice(0, 500);
}

function languageKey(path) {
  const name = basename(path);
  if (name === "Dockerfile") {
    return "Dockerfile";
  }
  const extension = extname(path).toLowerCase();
  if (!extension) {
    return "no-extension";
  }
  return extension.slice(1);
}

function renderMarkdown(summary) {
  const languages = summary.languages
    .slice(0, 8)
    .map((entry) => `- ${entry.language}: ${entry.count}`)
    .join("\n");
  const notable = summary.notableFiles.length > 0 ? summary.notableFiles.map((file) => `- ${file}`).join("\n") : "- None detected";
  const readme = summary.readmeExcerpt ? `\n## README Excerpt\n\n${summary.readmeExcerpt}\n` : "";

  return [
    `# Repo Summary: ${summary.name}`,
    "",
    `Path: \`${summary.path}\``,
    "",
    "## Scan",
    "",
    `- Files scanned: ${summary.scannedFileCount}`,
    `- Truncated: ${summary.truncated ? "yes" : "no"}`,
    "",
    "## File Types",
    "",
    languages || "- No files detected",
    "",
    "## Notable Files",
    "",
    notable,
    readme
  ].join("\n");
}
