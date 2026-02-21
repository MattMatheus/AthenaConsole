import type { PersonaDefinition } from "../personas/types.js";
import {
  ATHENA_LSP_DEFINITION_TOOL,
  ATHENA_LSP_REFERENCES_TOOL,
  ATHENA_LSP_SYMBOLS_TOOL
} from "./symbolic-navigation.js";

export interface ToolSpec {
  name: string;
  description: string;
}

export const FILESYSTEM_TOOLS: ToolSpec[] = [
  {
    name: "read_file",
    description: "Read text content from a local file path"
  },
  {
    name: "list_dir",
    description: "List local directory contents"
  },
  {
    name: "run_exec",
    description: "Run a local executable with explicit arguments"
  },
  {
    name: "memory_search",
    description: "Search indexed memory snippets with citations"
  },
  {
    name: "memory_get",
    description: "Read bounded line ranges from memory markdown files"
  }
];

export const SYMBOLIC_NAVIGATION_TOOLS: ToolSpec[] = [
  {
    name: ATHENA_LSP_DEFINITION_TOOL,
    description: "Return the symbol definition location and compact signature context"
  },
  {
    name: ATHENA_LSP_REFERENCES_TOOL,
    description: "Return compact caller and usage locations for the symbol"
  },
  {
    name: ATHENA_LSP_SYMBOLS_TOOL,
    description: "Return compact symbol definitions available in a file"
  }
];

export const STANDARD_AGENT_TOOLSET: ToolSpec[] = [...FILESYSTEM_TOOLS, ...SYMBOLIC_NAVIGATION_TOOLS];

export function personaHasSkill(persona: PersonaDefinition, expectedSkillId: string): boolean {
  const normalized = expectedSkillId.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (persona.skills ?? []).some((skill) => {
    if (skill.id.trim().toLowerCase() === normalized) {
      return true;
    }
    return (skill.tags ?? []).some((tag) => tag.trim().toLowerCase() === normalized);
  });
}

export function resolvePersonaToolset(persona: PersonaDefinition): ToolSpec[] {
  if (personaHasSkill(persona, "code-analysis")) {
    return STANDARD_AGENT_TOOLSET;
  }
  return FILESYSTEM_TOOLS;
}

export * from "./symbolic-navigation.js";
