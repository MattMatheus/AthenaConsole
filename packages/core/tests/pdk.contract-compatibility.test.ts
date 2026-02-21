import { describe, expectTypeOf, it } from "vitest";
import type { PersonaDefinition as RuntimePersonaDefinition, PersonaRunResult } from "../src/personas/types.js";
import type { PersonaRunRequest } from "../src/personas/run.js";
import type {
  PersonaDefinition as PdkPersonaDefinition,
  PersonaRunInput as PdkPersonaRunInput,
  PersonaRunOutput as PdkPersonaRunOutput
} from "@athena/pdk";

describe("pdk contract compatibility", () => {
  it("keeps PersonaDefinition assignable to runtime persona definition", () => {
    expectTypeOf<PdkPersonaDefinition>().toExtend<RuntimePersonaDefinition>();
  });

  it("keeps PersonaRunInput aligned to runtime run request", () => {
    expectTypeOf<PdkPersonaRunInput>().toExtend<PersonaRunRequest>();
  });

  it("keeps runtime run result assignable to PersonaRunOutput", () => {
    expectTypeOf<PersonaRunResult>().toExtend<PdkPersonaRunOutput>();
  });
});
