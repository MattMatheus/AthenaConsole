import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import type { AppStateDatabase } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import {
  loadYamlManifest,
  validateManifestFile,
  type ManifestValidationIssue
} from "../manifests/index.js";
import type { AthenaConfig } from "../../shared/config.js";

export const PLUGIN_MANIFEST_FILENAME = "plugin.yaml";

export type IndexedPluginSourceType = "local" | "system";

export interface PluginSearchPath {
  path: string;
  sourceType: IndexedPluginSourceType;
}

export interface IndexedAgentSummary {
  id: string;
  version: string;
  path: string;
  name: string;
  capabilities: string[];
}

export interface IndexedPluginSummary {
  id: string;
  version: string;
  path: string;
  sourceType: IndexedPluginSourceType;
  status: "loaded" | "invalid";
  enabled: boolean;
  validationErrors: ManifestValidationIssue[];
  agents: IndexedAgentSummary[];
}

export interface PluginIndexResult {
  plugins: IndexedPluginSummary[];
}

export interface PluginIndexOptions {
  appState?: AppStateDatabase;
  searchPaths?: string[];
  systemPluginPaths?: string[];
}

interface PluginResourceReference {
  path: string;
  id?: string;
  version?: string;
}

interface PluginManifestDocument {
  plugin?: {
    id?: string;
    version?: string;
    agents?: Array<string | PluginResourceReference>;
  };
}

interface AgentManifestDocument {
  agent?: {
    id?: string;
    version?: string;
    name?: string;
    capabilities?: string[];
  };
}

export function resolveConfiguredPluginSearchPaths(
  config: AthenaConfig,
  options: Pick<PluginIndexOptions, "searchPaths" | "systemPluginPaths"> = {}
): PluginSearchPath[] {
  return [
    ...(options.searchPaths ?? config.plugins?.searchPaths ?? []).map((path) => ({
      path: resolveConfiguredPath(config, path),
      sourceType: "local" as const
    })),
    ...(options.systemPluginPaths ?? config.plugins?.systemPluginPaths ?? []).map((path) => ({
      path: resolveConfiguredPath(config, path),
      sourceType: "system" as const
    }))
  ];
}

export function discoverLocalPluginRoots(searchPath: string): string[] {
  const rootPath = resolve(searchPath);
  if (!existsSync(rootPath)) {
    return [];
  }
  if (existsSync(resolve(rootPath, PLUGIN_MANIFEST_FILENAME))) {
    return [rootPath];
  }

  return readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(rootPath, entry.name))
    .filter((candidatePath) => existsSync(resolve(candidatePath, PLUGIN_MANIFEST_FILENAME)))
    .sort();
}

export function indexConfiguredLocalPlugins(config: AthenaConfig, options: PluginIndexOptions = {}): PluginIndexResult {
  const ownsAppState = !options.appState;
  const appState = options.appState ?? openAppStateDatabase(config);
  try {
    const searchPaths = resolveConfiguredPluginSearchPaths(config, options);
    const seenPluginRoots = new Set<string>();
    const plugins: IndexedPluginSummary[] = [];

    for (const searchPath of searchPaths) {
      for (const pluginRoot of discoverLocalPluginRoots(searchPath.path)) {
        const resolvedRoot = resolve(pluginRoot);
        if (seenPluginRoots.has(resolvedRoot)) {
          continue;
        }
        seenPluginRoots.add(resolvedRoot);
        plugins.push(indexLocalPluginPackage(appState, resolvedRoot, searchPath.sourceType));
      }
    }

    return { plugins };
  } finally {
    if (ownsAppState) {
      appState.close();
    }
  }
}

export function indexLocalPluginPackage(
  appState: AppStateDatabase,
  pluginRoot: string,
  sourceType: IndexedPluginSourceType = "local"
): IndexedPluginSummary {
  const pluginPath = resolve(pluginRoot);
  const pluginManifestPath = resolve(pluginPath, PLUGIN_MANIFEST_FILENAME);
  const pluginValidation = validateManifestFile("plugin", pluginManifestPath);
  const issues: ManifestValidationIssue[] = [...pluginValidation.issues];
  const pluginManifest = loadManifestIfPossible<PluginManifestDocument>(pluginManifestPath);
  const pluginId = pluginManifest?.plugin?.id ?? createInvalidPluginId(pluginPath);
  const pluginVersion = pluginManifest?.plugin?.version ?? "0.0.0";
  const agents: IndexedAgentSummary[] = [];

  if (pluginValidation.ok) {
    for (const reference of pluginManifest?.plugin?.agents ?? []) {
      const normalizedReference = normalizeResourceReference(reference);
      if (!normalizedReference) {
        continue;
      }

      const agentPath = resolvePathInside(pluginPath, normalizedReference.path);
      if (!agentPath) {
        issues.push({
          file: pluginManifestPath,
          path: "$.plugin.agents",
          message: `agent reference escapes plugin root: ${normalizedReference.path}`
        });
        continue;
      }

      const agentValidation = validateManifestFile("agent", agentPath);
      const agentIssues = [...agentValidation.issues];
      const agentManifest = loadManifestIfPossible<AgentManifestDocument>(agentPath);
      if (agentValidation.ok && normalizedReference.id && agentManifest?.agent?.id !== normalizedReference.id) {
        agentIssues.push({
          file: agentPath,
          path: "$.agent.id",
          message: `referenced agent id '${normalizedReference.id}' does not match manifest id '${
            agentManifest?.agent?.id ?? ""
          }'`
        });
      }
      if (agentValidation.ok && normalizedReference.version && agentManifest?.agent?.version !== normalizedReference.version) {
        agentIssues.push({
          file: agentPath,
          path: "$.agent.version",
          message: `referenced agent version '${normalizedReference.version}' does not match manifest version '${
            agentManifest?.agent?.version ?? ""
          }'`
        });
      }

      issues.push(...agentIssues);
      if (agentIssues.length === 0 && agentManifest?.agent?.id && agentManifest.agent.version) {
        agents.push({
          id: agentManifest.agent.id,
          version: agentManifest.agent.version,
          path: agentPath,
          name: agentManifest.agent.name ?? agentManifest.agent.id,
          capabilities: agentManifest.agent.capabilities ?? []
        });
      }
    }
  }

  const status = issues.length === 0 ? "loaded" : "invalid";
  const transaction = appState.db.transaction(() => {
    const pluginRecord = appState.plugins.upsert({
      id: pluginId,
      version: pluginVersion,
      path: pluginPath,
      sourceType,
      status,
      manifest: pluginManifest ?? {},
      validationErrors: issues
    });
    appState.agents.deleteForPlugin(pluginId, pluginVersion);
    if (status === "loaded") {
      for (const agent of agents) {
        appState.agents.upsert({
          id: agent.id,
          version: agent.version,
          pluginId,
          pluginVersion,
          name: agent.name,
          capabilities: agent.capabilities,
          manifest: loadManifestIfPossible(resolve(agent.path)) ?? {},
          status: "loaded"
        });
      }
    }
    return pluginRecord.enabled;
  });

  const enabled = transaction() as boolean;
  return {
    id: pluginId,
    version: pluginVersion,
    path: pluginPath,
    sourceType,
    status,
    enabled,
    validationErrors: issues,
    agents: status === "loaded" ? agents : []
  };
}

function resolveConfiguredPath(config: AthenaConfig, path: string): string {
  return isAbsolute(path) ? resolve(path) : resolve(config.workspaceRoot, path);
}

function loadManifestIfPossible<T>(filePath: string): T | undefined {
  try {
    if (!existsSync(filePath)) {
      return undefined;
    }
    return loadYamlManifest(filePath) as T;
  } catch {
    return undefined;
  }
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

function createInvalidPluginId(pluginRoot: string): string {
  return `invalid.${createHash("sha256").update(resolve(pluginRoot)).digest("hex").slice(0, 16)}`;
}
