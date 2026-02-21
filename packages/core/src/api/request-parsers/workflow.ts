import { AthenaError } from "../../runtime/errors.js";

export function parseCreateWorkflowRequest(body: Record<string, unknown>): {
  definition: {
    steps: Array<{
      id: string;
      directiveId: string;
      harnessProfileId: string;
      outputs?: string[];
      execution?: {
        maxAttempts?: number;
        timeoutMs?: number;
        metadata?: Record<string, string>;
      };
    }>;
    dependencies: Array<{
      from: string;
      to: string;
      mappings?: Array<{
        fromOutput: string;
        toInput: string;
      }>;
    }>;
  };
} {
  const definition = body.definition;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition must be an object.");
  }
  const row = definition as Record<string, unknown>;
  if (!Array.isArray(row.steps)) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition.steps must be an array.");
  }
  if (!Array.isArray(row.dependencies)) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition.dependencies must be an array.");
  }
  return {
    definition: {
      steps: row.steps as Array<{
        id: string;
        directiveId: string;
        harnessProfileId: string;
        outputs?: string[];
        execution?: {
          maxAttempts?: number;
          timeoutMs?: number;
          metadata?: Record<string, string>;
        };
      }>,
      dependencies: row.dependencies as Array<{
        from: string;
        to: string;
        mappings?: Array<{
          fromOutput: string;
          toInput: string;
        }>;
      }>
    }
  };
}
