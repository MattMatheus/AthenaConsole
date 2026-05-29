export type AgentInputFieldType =
  | "string"
  | "markdown"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "json"
  | "file"
  | "url"
  | "enum";

export interface AgentInputField {
  type: AgentInputFieldType;
  required?: boolean;
  description?: string;
  label?: string;
  default?: unknown;
  schema?: string;
  enum?: Array<string | number | boolean>;
  ui?: {
    widget?: "text" | "textarea" | "markdown" | "number" | "checkbox" | "select" | "file" | "json";
    placeholder?: string;
    order?: number;
  };
}

export type AgentInputContract = Record<string, AgentInputField>;

export interface AgentTaskRunEnvelope {
  task: {
    id: string;
    title?: string;
    description?: string;
    inputs?: unknown;
    [key: string]: unknown;
  };
  agent: {
    id: string;
    version?: string;
    [key: string]: unknown;
  };
  run: {
    id: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type AgentRunVerificationStatus = "passed" | "verification-failed";

export interface AgentRunVerificationFailure {
  policyId: string;
  kind: "require-evidence";
  message: string;
  details?: Record<string, string>;
}

export interface AgentRunArtifact {
  id?: string;
  label: string;
  kind: string;
  format: string;
  storageUri: string;
  sizeBytes?: number;
  hash?: string;
  metadata?: unknown;
  schemaValidation?: unknown;
}

export interface AgentRunOutputEnvelope<TOutput = unknown> {
  output: TOutput;
  artifacts: AgentRunArtifact[];
  verificationStatus?: AgentRunVerificationStatus;
  verificationFailures?: AgentRunVerificationFailure[];
}

export interface AgentInputValidationIssue {
  path: string;
  message: string;
}

export class AgentSdkValidationError extends Error {
  public readonly issues: AgentInputValidationIssue[];

  public constructor(message: string, issues: AgentInputValidationIssue[] = []) {
    super(message);
    this.name = "AgentSdkValidationError";
    this.issues = issues;
  }
}

export type AgentHandler<TInputs extends Record<string, unknown> = Record<string, unknown>, TOutput = unknown> = (
  context: AgentHandlerContext<TInputs>
) => AgentRunOutputEnvelope<TOutput> | Promise<AgentRunOutputEnvelope<TOutput>>;

export interface AgentHandlerContext<TInputs extends Record<string, unknown> = Record<string, unknown>> {
  envelope: AgentTaskRunEnvelope;
  inputs: TInputs;
  task: AgentTaskRunEnvelope["task"];
  agent: AgentTaskRunEnvelope["agent"];
  run: AgentTaskRunEnvelope["run"];
}

export interface RunAgentHandlerOptions<TInputs extends Record<string, unknown> = Record<string, unknown>> {
  envelope: AgentTaskRunEnvelope | string;
  inputContract?: AgentInputContract;
  inputs?: TInputs;
}

export function parseAgentTaskRunEnvelope(value: string | unknown): AgentTaskRunEnvelope {
  const parsed = typeof value === "string" ? parseJsonObject(value, "Agent task run envelope") : value;
  if (!isRecord(parsed)) {
    throw new AgentSdkValidationError("Agent task run envelope must be a JSON object.");
  }
  if (!isRecord(parsed.task) || typeof parsed.task.id !== "string" || parsed.task.id.trim().length === 0) {
    throw new AgentSdkValidationError("Agent task run envelope must include task.id.");
  }
  if (!isRecord(parsed.agent) || typeof parsed.agent.id !== "string" || parsed.agent.id.trim().length === 0) {
    throw new AgentSdkValidationError("Agent task run envelope must include agent.id.");
  }
  if (!isRecord(parsed.run) || typeof parsed.run.id !== "string" || parsed.run.id.trim().length === 0) {
    throw new AgentSdkValidationError("Agent task run envelope must include run.id.");
  }
  return parsed as AgentTaskRunEnvelope;
}

export function parseAgentInputs<TInputs extends Record<string, unknown> = Record<string, unknown>>(
  inputContract: AgentInputContract,
  inputs: unknown
): TInputs {
  const values = isRecord(inputs) ? inputs : {};
  const result: Record<string, unknown> = {};
  const issues: AgentInputValidationIssue[] = [];

  for (const [key, field] of Object.entries(inputContract)) {
    const value = values[key];
    if (value === undefined || value === null) {
      if (value === undefined && field.default !== undefined) {
        result[key] = field.default;
        continue;
      }
      if (field.required) {
        issues.push({ path: key, message: `task.inputs.${key} is required.` });
      }
      continue;
    }

    const issue = validateInputValue(key, field, value);
    if (issue) {
      issues.push(issue);
      continue;
    }
    result[key] = value;
  }

  if (issues.length > 0) {
    throw new AgentSdkValidationError("Agent inputs failed validation.", issues);
  }

  return result as TInputs;
}

export function parseAgentEnvelopeInputs<TInputs extends Record<string, unknown> = Record<string, unknown>>(
  envelope: AgentTaskRunEnvelope,
  inputContract: AgentInputContract
): TInputs {
  return parseAgentInputs<TInputs>(inputContract, envelope.task.inputs);
}

export function createAgentArtifact(artifact: AgentRunArtifact): AgentRunArtifact {
  if (typeof artifact.storageUri !== "string" || artifact.storageUri.trim().length === 0) {
    throw new AgentSdkValidationError("Agent artifact must include storageUri.");
  }
  return {
    label: artifact.label?.trim() ? artifact.label : "Artifact",
    kind: artifact.kind?.trim() ? artifact.kind : "supporting",
    format: artifact.format?.trim() ? artifact.format : "text",
    storageUri: artifact.storageUri,
    ...(artifact.id ? { id: artifact.id } : {}),
    ...(artifact.sizeBytes !== undefined ? { sizeBytes: artifact.sizeBytes } : {}),
    ...(artifact.hash ? { hash: artifact.hash } : {}),
    ...(artifact.metadata !== undefined ? { metadata: artifact.metadata } : {}),
    ...(artifact.schemaValidation !== undefined ? { schemaValidation: artifact.schemaValidation } : {})
  };
}

export function createAgentRunOutput<TOutput>(
  output: TOutput,
  options: {
    artifacts?: AgentRunArtifact[];
    verificationStatus?: AgentRunVerificationStatus;
    verificationFailures?: AgentRunVerificationFailure[];
  } = {}
): AgentRunOutputEnvelope<TOutput> {
  return {
    output,
    artifacts: (options.artifacts ?? []).map(createAgentArtifact),
    ...(options.verificationStatus ? { verificationStatus: options.verificationStatus } : {}),
    ...(options.verificationFailures ? { verificationFailures: options.verificationFailures } : {})
  };
}

export function serializeAgentRunOutput(envelope: AgentRunOutputEnvelope): string {
  return `${JSON.stringify(envelope)}\n`;
}

export async function runAgentHandler<TInputs extends Record<string, unknown>, TOutput>(
  handler: AgentHandler<TInputs, TOutput>,
  options: RunAgentHandlerOptions<TInputs>
): Promise<AgentRunOutputEnvelope<TOutput>> {
  const envelope = typeof options.envelope === "string" ? parseAgentTaskRunEnvelope(options.envelope) : parseAgentTaskRunEnvelope(options.envelope);
  const inputs = options.inputs ?? (options.inputContract ? parseAgentEnvelopeInputs<TInputs>(envelope, options.inputContract) : (envelope.task.inputs as TInputs));
  return handler({
    envelope,
    inputs,
    task: envelope.task,
    agent: envelope.agent,
    run: envelope.run
  });
}

function parseJsonObject(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new AgentSdkValidationError(`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateInputValue(key: string, field: AgentInputField, value: unknown): AgentInputValidationIssue | undefined {
  const type = field.type;
  if ((type === "string" || type === "markdown" || type === "file" || type === "url") && typeof value !== "string") {
    return { path: key, message: `task.inputs.${key} must be a string.` };
  }
  if (type === "integer" && (!Number.isInteger(value) || typeof value !== "number")) {
    return { path: key, message: `task.inputs.${key} must be an integer.` };
  }
  if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    return { path: key, message: `task.inputs.${key} must be a number.` };
  }
  if (type === "boolean" && typeof value !== "boolean") {
    return { path: key, message: `task.inputs.${key} must be a boolean.` };
  }
  if (type === "object" && !isRecord(value)) {
    return { path: key, message: `task.inputs.${key} must be an object.` };
  }
  if (type === "array" && !Array.isArray(value)) {
    return { path: key, message: `task.inputs.${key} must be an array.` };
  }
  if (type === "enum" && field.enum && !field.enum.includes(value as string | number | boolean)) {
    return { path: key, message: `task.inputs.${key} must be one of the configured enum values.` };
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
