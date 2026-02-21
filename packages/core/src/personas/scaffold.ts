import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PersonaDefinition } from "./types.js";
import { assertValidPersonaName, resolveSpecialistsDirectory } from "./loader.js";

export interface PersonaScaffoldInput {
  workspaceRoot: string;
  name: string;
  role: string;
  description: string;
}

export interface PersonaScaffoldResult {
  name: string;
  manifestPath: string;
  specialistDir: string;
  // Deprecated aliases kept for downstream compatibility.
  definitionPath: string;
  nestedDefinitionPath: string;
  personaDir: string;
  files: string[];
}

function buildPersonaDefinition(input: PersonaScaffoldInput): PersonaDefinition {
  return {
    schemaVersion: 1,
    id: input.name,
    description: input.description,
    context: {
      promptFiles: ["prompt.md"],
      skillFiles: ["skills.md"],
      docFiles: ["docs.md"],
      maxFileChars: 20_000,
      maxTotalChars: 120_000
    },
    skills: [
      {
        id: "code-analysis",
        tags: ["navigation", "review"]
      }
    ],
    git: {
      baseRefDefault: "main",
      requireCleanWorktree: true,
      baseRefAutodetect: true
    },
    review: {
      scope: "diff",
      inspectAddedDependencies: true,
      rubric: {
        correctness: true,
        security: true,
        performance: true,
        maintainability: true,
        testGaps: true
      },
      maxReferencedFiles: 16,
      maxReferencedFileChars: 12_000,
      includeGlobs: ["**/*"],
      excludeGlobs: ["**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**", "**/vendor/**"]
    },
    output: {
      defaultFormat: "both",
      writeJsonFile: true,
      writeMarkdownFile: true,
      stdoutDefault: "summary"
    }
  };
}

function buildPromptTemplate(input: PersonaScaffoldInput): string {
  return [
    `# ${input.name} Prompt`,
    "",
    "## Role",
    input.role,
    "",
    "## Objective",
    input.description,
    "",
    "## Output Contract",
    "- Return strict JSON when required by runtime contract.",
    "- Use deterministic ordering and stable wording.",
    "- Include concrete, actionable findings with file references when available.",
    ""
  ].join("\n");
}

function buildSkillsTemplate(input: PersonaScaffoldInput): string {
  return [
    `# ${input.name} Skills`,
    "",
    "- Prioritize correctness and security first.",
    "- Keep recommendations additive and backward-compatible.",
    "- Preserve lock-guarded transitions and cleanup invariants.",
    ""
  ].join("\n");
}

function buildDocsTemplate(input: PersonaScaffoldInput): string {
  return [
    `# ${input.name} Docs`,
    "",
    "## Description",
    input.description,
    "",
    "## Repository Conventions",
    "- Add project-specific conventions here.",
    ""
  ].join("\n");
}

function buildValidationTestTemplate(input: PersonaScaffoldInput): string {
  return [
    "import { describe, expect, it } from \"vitest\";",
    "import { readFileSync } from \"node:fs\";",
    "import { resolve } from \"node:path\";",
    "",
    `describe(\"${input.name} specialist manifest\", () => {`,
    "  it(\"keeps id aligned with folder\", () => {",
    "    const manifestPath = resolve(import.meta.dirname, \"..\", \"manifest.json\");",
    "    const manifest = JSON.parse(readFileSync(manifestPath, \"utf8\")) as { id?: string };",
    `    expect(manifest.id).toBe(\"${input.name}\");`,
    "  });",
    "});",
    ""
  ].join("\n");
}

export async function scaffoldPersona(input: PersonaScaffoldInput): Promise<PersonaScaffoldResult> {
  assertValidPersonaName(input.name);

  const role = input.role.trim();
  const description = input.description.trim();
  if (!role) {
    throw new Error("Persona role must be a non-empty string.");
  }
  if (!description) {
    throw new Error("Persona description must be a non-empty string.");
  }

  const specialistsDir = resolveSpecialistsDirectory(input.workspaceRoot);
  const specialistDir = resolve(specialistsDir, input.name);
  const manifestPath = resolve(specialistDir, "manifest.json");
  const promptPath = resolve(specialistDir, "prompt.md");
  const skillsPath = resolve(specialistDir, "skills.md");
  const docsPath = resolve(specialistDir, "docs.md");
  const testsDir = resolve(specialistDir, "tests");
  const validationTestPath = resolve(testsDir, "manifest.spec.ts");
  const legacyDefinitionPath = resolve(input.workspaceRoot, "personas", `${input.name}.json`);
  const legacyNestedPath = resolve(input.workspaceRoot, "personas", input.name, "persona.json");

  const targets = [manifestPath, promptPath, skillsPath, docsPath, validationTestPath, legacyDefinitionPath, legacyNestedPath];
  const existingTargets = targets.filter((path) => existsSync(path));
  if (existingTargets.length > 0) {
    throw new Error(`Refusing to overwrite existing persona scaffold files: ${existingTargets.join(", ")}`);
  }

  await mkdir(specialistDir, { recursive: true });
  await mkdir(testsDir, { recursive: true });

  const definition = buildPersonaDefinition({ ...input, role, description });
  const definitionJson = `${JSON.stringify(definition, null, 2)}\n`;

  await Promise.all([
    writeFile(manifestPath, definitionJson, "utf8"),
    writeFile(promptPath, buildPromptTemplate({ ...input, role, description }), "utf8"),
    writeFile(skillsPath, buildSkillsTemplate({ ...input, role, description }), "utf8"),
    writeFile(docsPath, buildDocsTemplate({ ...input, role, description }), "utf8"),
    writeFile(validationTestPath, buildValidationTestTemplate({ ...input, role, description }), "utf8")
  ]);

  return {
    name: input.name,
    manifestPath,
    specialistDir,
    definitionPath: manifestPath,
    nestedDefinitionPath: manifestPath,
    personaDir: specialistDir,
    files: [manifestPath, promptPath, skillsPath, docsPath, validationTestPath]
  };
}
