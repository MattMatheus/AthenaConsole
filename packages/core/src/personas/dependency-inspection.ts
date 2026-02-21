import type { DependencyInspection } from "./types.js";
import { fileExistsAtRef, readFileAtRef } from "./git.js";

const KNOWN_MANIFESTS: Array<{ ecosystem: string; paths: string[]; required?: string[] }> = [
  { ecosystem: "node", paths: ["package.json"], required: ["package.json"] },
  { ecosystem: "python", paths: ["pyproject.toml", "requirements.txt", "Pipfile"], required: ["pyproject.toml", "requirements.txt", "Pipfile"] },
  { ecosystem: "go", paths: ["go.mod"], required: ["go.mod"] },
  { ecosystem: "rust", paths: ["Cargo.toml"], required: ["Cargo.toml"] },
  { ecosystem: "java", paths: ["pom.xml", "build.gradle", "build.gradle.kts"], required: ["pom.xml", "build.gradle", "build.gradle.kts"] }
];

function extractAddedImports(diff: string, maxLines: number): string[] {
  const lines = diff.split(/\r?\n/);
  const imports: string[] = [];
  const patterns: RegExp[] = [
    /^\+\s*import\s+.+\s+from\s+['"][^'"]+['"]\s*;?\s*$/,
    /^\+\s*(?:const|let|var)\s+.+\s*=\s*require\(\s*['"][^'"]+['"]\s*\)\s*;?\s*$/,
    /^\+\s*from\s+\S+\s+import\s+/,
    /^\+\s*import\s+\S+/,
    /^\+\s*require\s*\(\s*['"][^'"]+['"]\s*\)\s*;?\s*$/,
    /^\+\s*import\s+\(\s*['"][^'"]+['"]\s*\)\s*;?\s*$/,
    /^\+\s*use\s+\S+/,
    /^\+\s*import\s+\"[^\"]+\"/
  ];

  for (const line of lines) {
    if (imports.length >= maxLines) {
      break;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) {
      continue;
    }
    const trimmed = line.trimEnd();
    if (patterns.some((pattern) => pattern.test(trimmed))) {
      imports.push(trimmed.slice(1).trim());
    }
  }
  return imports;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function inspectDependenciesBestEffort(options: {
  repoPath: string;
  headRef: string;
  changedFiles: string[];
  diff: string;
}): Promise<DependencyInspection> {
  const changedManifests: string[] = [];
  let detectedEcosystem: string | undefined;

  for (const candidate of KNOWN_MANIFESTS) {
    const hits = candidate.paths.filter((p) => options.changedFiles.includes(p));
    if (hits.length > 0) {
      detectedEcosystem = candidate.ecosystem;
      changedManifests.push(...hits);
    }
  }

  const addedImports = extractAddedImports(options.diff, 80);

  // If we detected an ecosystem, confirm at least one required artifact exists in HEAD.
  const notes: string[] = [];
  if (detectedEcosystem) {
    const candidate = KNOWN_MANIFESTS.find((row) => row.ecosystem === detectedEcosystem);
    const required = candidate?.required ?? [];
    const existsChecks = await Promise.all(required.map((path) => fileExistsAtRef(options.repoPath, options.headRef, path)));
    if (existsChecks.every((ok) => !ok)) {
      notes.push(
        `Detected ecosystem '${detectedEcosystem}' from changed manifests, but required artifacts were not present at ${options.headRef}; dependency inspection skipped.`
      );
      return {
        status: "skipped",
        detectedEcosystem,
        notes,
        addedImports: unique(addedImports),
        changedManifests: unique(changedManifests)
      };
    }

    // Attach small manifest snippets for model context when available.
    for (const path of unique(changedManifests).slice(0, 3)) {
      try {
        const content = await readFileAtRef(options.repoPath, options.headRef, path, 30_000);
        notes.push(`Manifest snapshot (${path} @ ${options.headRef}):\n${content}`);
      } catch {
        // Ignore; best-effort.
      }
    }
  }

  if (!detectedEcosystem && changedManifests.length === 0 && addedImports.length === 0) {
    return {
      status: "skipped",
      notes: ["No known dependency manifests changed and no obvious new imports detected in the diff."],
      addedImports: [],
      changedManifests: []
    };
  }

  return {
    status: "ok",
    ...(detectedEcosystem ? { detectedEcosystem } : {}),
    ...(notes.length > 0 ? { notes } : {}),
    addedImports: unique(addedImports),
    changedManifests: unique(changedManifests)
  };
}
