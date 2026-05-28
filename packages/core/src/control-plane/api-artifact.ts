import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { API_V1_ROUTES } from "./api-contracts.js";
import { API_COMPONENT_SCHEMAS, API_V1_OPERATION_SCHEMAS, toOpenApiPath, type ApiSchema } from "./api-schemas.js";

export interface OpenApiParameterArtifact {
  name: string;
  in: "path" | "query";
  required: boolean;
  schema: ApiSchema;
}

export interface OpenApiOperationArtifact {
  operationId: string;
  deprecated?: boolean;
  parameters?: OpenApiParameterArtifact[];
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: ApiSchema;
      };
    };
  };
  responses: Record<string, unknown>;
  "x-athena-stream"?: "sse";
  "x-athena-queryMode"?: "cursor-page" | "tail";
  "x-athena-lifecycle"?: "stable" | "deprecated";
  "x-athena-surface"?: "canonical" | "legacy-file-backed-workflow";
  "x-athena-canonicalPath"?: string;
}

export interface ApiContractArtifact {
  schemaVersion: 2;
  apiVersion: "v1";
  generatedAt: string;
  routeCount: number;
  openapi: {
    openapi: "3.1.0";
    info: {
      title: string;
      version: string;
    };
    servers: Array<{
      url: string;
    }>;
    paths: Record<string, Record<string, OpenApiOperationArtifact>>;
    components: {
      schemas: Record<string, ApiSchema>;
    };
  };
}

const DEFAULT_ARTIFACT_RELATIVE_PATH = ".athena/api/contracts.v1.json";

export function buildApiContractArtifact(now = new Date()): ApiContractArtifact {
  const paths: Record<string, Record<string, OpenApiOperationArtifact>> = {};

  for (const route of API_V1_ROUTES) {
    const operationSchema = API_V1_OPERATION_SCHEMAS[route.operationId];
    if (!operationSchema) {
      continue;
    }

    const openApiPath = toOpenApiPath(route.path);
    const method = route.method.toLowerCase();
    const operation: OpenApiOperationArtifact = {
      operationId: route.operationId,
      responses: buildOperationResponses(operationSchema.responseSchema, Boolean(route.stream)),
      ...(route.lifecycle === "deprecated" ? { deprecated: true } : {}),
      ...(route.stream ? { "x-athena-stream": route.stream } : {}),
      ...(route.queryMode ? { "x-athena-queryMode": route.queryMode } : {}),
      ...(route.lifecycle ? { "x-athena-lifecycle": route.lifecycle } : {}),
      ...(route.surface ? { "x-athena-surface": route.surface } : {}),
      ...(route.canonicalPath ? { "x-athena-canonicalPath": route.canonicalPath } : {})
    };

    const queryParameters = buildParameters(operationSchema.querySchema, "query");
    const pathParameters = buildParameters(operationSchema.pathParamsSchema, "path");
    const allParameters = [...pathParameters, ...queryParameters];
    if (allParameters.length > 0) {
      operation.parameters = allParameters;
    }

    if (operationSchema.requestBodySchema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: operationSchema.requestBodySchema
          }
        }
      };
    }

    paths[openApiPath] = {
      ...(paths[openApiPath] ?? {}),
      [method]: operation
    };
  }

  return {
    schemaVersion: 2,
    apiVersion: "v1",
    generatedAt: now.toISOString(),
    routeCount: API_V1_ROUTES.length,
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "ProjectAthena Control-Plane API",
        version: "v1"
      },
      servers: [{ url: "/" }],
      paths,
      components: {
        schemas: {
          ...API_COMPONENT_SCHEMAS,
          ApiSuccessEnvelope: {
            type: "object",
            additionalProperties: false,
            properties: {
              ok: { type: "boolean" },
              data: { type: "object", additionalProperties: true }
            },
            required: ["ok", "data"]
          },
          ApiErrorEnvelope: {
            type: "object",
            additionalProperties: false,
            properties: {
              ok: { type: "boolean" },
              error: {
                type: "object",
                additionalProperties: false,
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                  retryable: { type: "boolean" },
                  traceId: { type: "string" }
                },
                required: ["code", "message", "retryable"]
              }
            },
            required: ["ok", "error"]
          }
        }
      }
    }
  };
}

export async function writeApiContractArtifact(
  workspaceRoot: string,
  outPath?: string
): Promise<{ path: string; artifact: ApiContractArtifact }> {
  const targetPath = resolve(workspaceRoot, outPath?.trim() || DEFAULT_ARTIFACT_RELATIVE_PATH);
  const artifact = buildApiContractArtifact();
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return {
    path: targetPath,
    artifact
  };
}

function buildParameters(schema: ApiSchema | undefined, location: "path" | "query"): OpenApiParameterArtifact[] {
  if (!schema || !("type" in schema) || schema.type !== "object") {
    return [];
  }

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  return Object.entries(properties).map(([name, childSchema]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.has(name),
    schema: childSchema
  }));
}

function buildOperationResponses(responseSchema: ApiSchema | undefined, isStream: boolean): Record<string, unknown> {
  if (!responseSchema) {
    return {
      "204": {
        description: "No content"
      }
    };
  }

  if (isStream) {
    return {
      "200": {
        description: "Server-sent events stream",
        content: {
          "text/event-stream": {
            schema: responseSchema
          }
        }
      },
      default: {
        description: "Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorEnvelope" }
          }
        }
      }
    };
  }

  return {
    "200": {
      description: "Success",
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ok: { type: "boolean" },
              data: responseSchema
            },
            required: ["ok", "data"]
          }
        }
      }
    },
    default: {
      description: "Error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/ApiErrorEnvelope" }
        }
      }
    }
  };
}
