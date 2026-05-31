import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourcePath = resolve(repoRoot, "src/shared/contracts.ts");
const outputPath = resolve(repoRoot, "src/control-plane/generated-component-schemas.ts");

const SHARED_COMPONENT_NAMES = [
  "ContextRecoveryStep",
  "ContextCompactionMetadata",
  "RunResult",
  "CancelRunResult",
  "CancelRunByRunIdResult",
  "ActiveRunRecord",
  "ActiveRunQueryResult",
  "CancellationRequestRecord",
  "CancellationRequestQueryResult",
  "SessionRecord",
  "SessionSearchResult",
  "SessionSearchResultItem",
  "SessionArtifactSummary",
  "SessionArtifactRecord",
  "Directive",
  "DirectiveListResult",
  "HarnessProfile",
  "HarnessProfileListResult",
  "RunTemplate",
  "RunTemplateListResult",
  "Workflow",
  "WorkflowRun",
  "TranscriptEntry",
  "WorkItem",
  "WorkQueueState",
  "ScheduledTask",
  "ScheduleRunLog",
  "CapabilitySet",
  "EventRecord",
  "EventQueryResult",
  "FailedWorkItem",
  "FailedWorkListResult",
  "A2aFlowNode",
  "A2aFlowEdge",
  "A2aFlowGraphResult",
  "A2aQueueThroughputPoint",
  "A2aLatencyHeatmapCell",
  "A2aStallAlert",
  "A2aStallAlertHistoryEntry",
  "A2aStallAlertHistoryResult",
  "A2aObservabilityResult",
  "PolicyDocument",
  "RunRejectionEvent",
  "PolicyConcurrencyRejectionRecord",
  "PolicyConcurrencyRejectionQueryResult",
  "OperationsSummary",
  "MemorySearchResult",
  "RbacRoleDefinition",
  "IdentityRoleAssignment",
  "IdentityRoleAuditResult",
  "GovernanceAuditDiffField",
  "GovernanceAuditEntry",
  "GovernanceAuditHistoryResult"
];

function main() {
  const checkMode = process.argv.includes("--check");
  const program = createProgram();
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(sourcePath);
  if (!sourceFile) {
    throw new Error(`Could not load source file: ${sourcePath}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    throw new Error(`Could not load module symbol for: ${sourcePath}`);
  }

  const exportMap = new Map();
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    exportMap.set(symbol.getName(), symbol);
  }

  const schemas = {};
  for (const name of SHARED_COMPONENT_NAMES) {
    const symbol = exportMap.get(name);
    if (!symbol) {
      throw new Error(`Missing exported type in shared contracts: ${name}`);
    }
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    schemas[name] = toSchema(checker, declared);
  }

  const content = renderFile(schemas);
  if (checkMode) {
    const existing = readFileSync(outputPath, "utf8");
    if (existing !== content) {
      console.error("Generated API component schemas are out of date.");
      process.exit(1);
    }
    return;
  }

  writeFileSync(outputPath, content, "utf8");
}

function createProgram() {
  const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) {
    throw new Error("Could not find tsconfig.json");
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(configPath));
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, "\n")).join("\n"));
  }

  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options
  });
}

function toSchema(checker, type) {
  if (type.isUnion()) {
    return unionToSchema(checker, type.types);
  }

  if ((type.flags & ts.TypeFlags.StringLiteral) !== 0) {
    return { type: "string", enum: [type.value] };
  }

  if ((type.flags & ts.TypeFlags.StringLike) !== 0) {
    return { type: "string" };
  }

  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) {
    return { type: "boolean" };
  }

  if ((type.flags & ts.TypeFlags.NumberLike) !== 0) {
    return { type: "number" };
  }

  if ((type.flags & ts.TypeFlags.Null) !== 0) {
    return { type: "null" };
  }

  if ((type.flags & ts.TypeFlags.Undefined) !== 0) {
    return { type: "null" };
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const elementTypes = checker.getTypeArguments(type);
    const itemType = elementTypes[0] ?? checker.getAnyType();
    return {
      type: "array",
      items: toSchema(checker, itemType)
    };
  }

  if ((type.flags & ts.TypeFlags.Object) !== 0) {
    return objectToSchema(checker, type);
  }

  if ((type.flags & ts.TypeFlags.Any) !== 0 || (type.flags & ts.TypeFlags.Unknown) !== 0) {
    return {
      type: "object",
      additionalProperties: true
    };
  }

  return {
    type: "string"
  };
}

function unionToSchema(checker, variants) {
  const definedVariants = variants.filter((variant) => (variant.flags & ts.TypeFlags.Undefined) === 0);
  if (definedVariants.length === 1) {
    return toSchema(checker, definedVariants[0]);
  }

  if (definedVariants.length > 0 && definedVariants.every((variant) => (variant.flags & ts.TypeFlags.StringLiteral) !== 0)) {
    return {
      type: "string",
      enum: definedVariants.map((variant) => variant.value)
    };
  }

  const rendered = [];
  const seen = new Set();
  for (const variant of definedVariants) {
    const schema = toSchema(checker, variant);
    const key = JSON.stringify(schema);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rendered.push(schema);
  }

  if (rendered.length === 1) {
    return rendered[0];
  }

  return {
    anyOf: rendered
  };
}

function objectToSchema(checker, type) {
  const properties = checker.getPropertiesOfType(type);
  const indexType = checker.getIndexTypeOfType(type, ts.IndexKind.String);

  if (properties.length === 0) {
    if (indexType) {
      return {
        type: "object",
        additionalProperties: indexType.flags & ts.TypeFlags.Unknown ? true : toSchema(checker, indexType)
      };
    }
    return {
      type: "object",
      additionalProperties: false
    };
  }

  const mappedProperties = {};
  const required = [];

  for (const property of properties) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) {
      continue;
    }

    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
    const isOptional = (property.flags & ts.SymbolFlags.Optional) !== 0 || hasUndefined(propertyType);
    const nonUndefinedType = excludeUndefined(checker, propertyType);

    mappedProperties[property.getName()] = toSchema(checker, nonUndefinedType);
    if (!isOptional) {
      required.push(property.getName());
    }
  }

  return {
    type: "object",
    additionalProperties: indexType ? (indexType.flags & ts.TypeFlags.Unknown ? true : toSchema(checker, indexType)) : false,
    properties: mappedProperties,
    ...(required.length > 0 ? { required } : {})
  };
}

function hasUndefined(type) {
  if (!type.isUnion()) {
    return (type.flags & ts.TypeFlags.Undefined) !== 0;
  }
  return type.types.some((item) => (item.flags & ts.TypeFlags.Undefined) !== 0);
}

function excludeUndefined(checker, type) {
  if (!type.isUnion()) {
    return type;
  }
  const filtered = type.types.filter((item) => (item.flags & ts.TypeFlags.Undefined) === 0);
  if (filtered.length === 1) {
    return filtered[0];
  }
  return checker.getUnionType(filtered, ts.UnionReduction.None);
}

function renderFile(schemas) {
  const payload = JSON.stringify(schemas, null, 2);
  return `// AUTO-GENERATED FILE. DO NOT EDIT.\n// Generated by scripts/generate-api-component-schemas.mjs\n\nimport type { ApiSchema } from "./api-schemas.js";\n\nexport const GENERATED_COMPONENT_SCHEMAS: Record<string, ApiSchema> = ${payload};\n`;
}

main();
