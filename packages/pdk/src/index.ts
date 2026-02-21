export type {
  Context,
  ContextReference,
  DependencyInspection,
  FindingPriority,
  PersonaDefinition,
  PersonaOutputStdout,
  PersonaRunInput,
  PersonaRunOutput,
  ReviewFinding,
  Skill
} from "./contracts.js";
import type { PersonaDefinition } from "./contracts.js";

export { definePersona } from "./define-persona.js";
export { assertValidPersonaName, clampConfidence, isFindingPriority, isValidPersonaName } from "./helpers.js";
import { definePersona } from "./define-persona.js";

export const SPECIALISTS_DIRNAME = "specialists";
export const SPECIALIST_MANIFEST_FILENAME = "manifest.json";

export function defineSpecialist(definition: PersonaDefinition): PersonaDefinition {
  return definePersona(definition);
}

export {
  MockFileStateStore,
  MockGitService,
  MockRuntime,
  PersonaTestHarness,
  type MockRuntimeOptions,
  type MockRuntimeResponse,
  type MockRuntimeRunRequest,
  type PersonaFileStateStore,
  type PersonaGitService,
  type PersonaTestHarnessContextEntry,
  type PersonaTestHarnessOptions,
  type PersonaTestHarnessResult,
  type PersonaTestHarnessRunRequest
} from "./test-harness.js";
