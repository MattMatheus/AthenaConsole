import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { load as loadYaml } from "js-yaml";

export type TeamOrchestratorManifestKind = "plugin" | "agent";

export interface ManifestValidationIssue {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
}

export interface ManifestValidationResult {
  ok: boolean;
  issues: ManifestValidationIssue[];
}

export interface ManifestValidationOptions {
  schemaRoot?: string;
}

export interface PluginPackageValidationOptions extends ManifestValidationOptions {
  pluginManifestFileName?: string;
}

interface PluginResourceReference {
  path: string;
  id?: string;
  version?: string;
}

interface PluginManifestDocument {
  plugin?: {
    agents?: Array<string | PluginResourceReference>;
  };
}

interface AgentManifestDocument {
  agent?: {
    id?: string;
    version?: string;
  };
}

const MANIFEST_SCHEMA_RELATIVE_ROOT = "schemas/team-orchestrator/manifests/v1";

const schemaCache = new Map<string, ValidateFunction>();

export function resolveManifestSchemaRoot(): string {
  return resolve(findCorePackageRoot(dirname(fileURLToPath(import.meta.url))), MANIFEST_SCHEMA_RELATIVE_ROOT);
}

export function loadYamlManifest(filePath: string): unknown {
  return loadYaml(readFileSync(filePath, "utf8"));
}

export function validateManifestDocument(
  kind: TeamOrchestratorManifestKind,
  document: unknown,
  options: ManifestValidationOptions = {}
): ManifestValidationResult {
  const validate = getValidator(kind, options.schemaRoot);
  const ok = validate(document) as boolean;
  return {
    ok,
    issues: ok ? [] : mapAjvErrors(validate.errors ?? [])
  };
}

export function validateManifestFile(
  kind: TeamOrchestratorManifestKind,
  filePath: string,
  options: ManifestValidationOptions = {}
): ManifestValidationResult {
  if (!existsSync(filePath)) {
    return {
      ok: false,
      issues: [
        {
          file: filePath,
          path: "$",
          message: "manifest file does not exist"
        }
      ]
    };
  }

  let document: unknown;
  try {
    document = loadYamlManifest(filePath);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          file: filePath,
          path: "$",
          message: `failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }

  return withFile(validateManifestDocument(kind, document, options), filePath);
}

export function validatePluginPackage(
  pluginRoot: string,
  options: PluginPackageValidationOptions = {}
): ManifestValidationResult {
  const pluginManifestPath = resolve(pluginRoot, options.pluginManifestFileName ?? "plugin.yaml");
  const pluginValidation = validateManifestFile("plugin", pluginManifestPath, options);
  const issues = [...pluginValidation.issues];
  if (!pluginValidation.ok) {
    return { ok: false, issues };
  }

  const pluginDocument = loadYamlManifest(pluginManifestPath) as PluginManifestDocument;
  for (const reference of pluginDocument.plugin?.agents ?? []) {
    const normalizedReference = normalizeResourceReference(reference);
    if (!normalizedReference) {
      continue;
    }

    const agentPath = resolvePathInside(pluginRoot, normalizedReference.path);
    if (!agentPath) {
      issues.push({
        file: pluginManifestPath,
        path: "$.plugin.agents",
        message: `agent reference escapes plugin root: ${normalizedReference.path}`
      });
      continue;
    }

    const agentValidation = validateManifestFile("agent", agentPath, options);
    issues.push(...agentValidation.issues);
    if (!agentValidation.ok) {
      continue;
    }

    const agentDocument = loadYamlManifest(agentPath) as AgentManifestDocument;
    if (normalizedReference.id && agentDocument.agent?.id !== normalizedReference.id) {
      issues.push({
        file: agentPath,
        path: "$.agent.id",
        message: `referenced agent id '${normalizedReference.id}' does not match manifest id '${agentDocument.agent?.id ?? ""}'`
      });
    }
    if (normalizedReference.version && agentDocument.agent?.version !== normalizedReference.version) {
      issues.push({
        file: agentPath,
        path: "$.agent.version",
        message: `referenced agent version '${normalizedReference.version}' does not match manifest version '${
          agentDocument.agent?.version ?? ""
        }'`
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

function getValidator(kind: TeamOrchestratorManifestKind, schemaRoot: string = resolveManifestSchemaRoot()): ValidateFunction {
  const schemaPath = resolve(schemaRoot, `${kind}.schema.json`);
  const cached = schemaCache.get(schemaPath);
  if (cached) {
    return cached;
  }

  const ajv = new Ajv({ allErrors: true });
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;
  const validator = ajv.compile(schema);
  schemaCache.set(schemaPath, validator);
  return validator;
}

function mapAjvErrors(errors: ErrorObject[]): ManifestValidationIssue[] {
  return errors.map((error) => ({
    path: error.dataPath || "$",
    message: error.message ?? "schema validation failed",
    keyword: error.keyword
  }));
}

function withFile(result: ManifestValidationResult, filePath: string): ManifestValidationResult {
  return {
    ok: result.ok,
    issues: result.issues.map((issue) => ({
      ...issue,
      file: issue.file ?? filePath
    }))
  };
}

function normalizeResourceReference(reference: string | PluginResourceReference): PluginResourceReference | undefined {
  if (typeof reference === "string") {
    return { path: reference };
  }
  if (reference && typeof reference.path === "string") {
    return reference;
  }
  return undefined;
}

function resolvePathInside(root: string, relativePath: string): string | undefined {
  const rootPath = resolve(root);
  const candidatePath = resolve(rootPath, relativePath);
  if (candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${sep}`)) {
    return candidatePath;
  }
  return undefined;
}

function findCorePackageRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    const packageJsonPath = resolve(current, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
      if (packageJson.name === "@athena/core") {
        return current;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error("Unable to locate @athena/core package root for manifest schemas.");
    }
    current = parent;
  }
}
