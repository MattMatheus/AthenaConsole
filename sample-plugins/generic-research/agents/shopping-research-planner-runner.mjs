import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  objective: {
    type: "string",
    required: true
  },
  constraints: {
    type: "object"
  },
  preferences: {
    type: "object"
  },
  decisionDeadline: {
    type: "string"
  }
};

try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const objective = inputs.objective;
  const constraints = toEntries(inputs.constraints);
  const preferences = toEntries(inputs.preferences);
  const deadline = typeof inputs.decisionDeadline === "string" && inputs.decisionDeadline.trim() ? inputs.decisionDeadline.trim() : "not specified";
  const markdown = renderPlan({ objective, constraints, preferences, deadline });
  const artifact = createAgentArtifact({
    id: `research-plan-${envelope.run.id}`,
    label: `Research plan: ${objective}`,
    kind: "primary",
    format: "markdown",
    storageUri: `memory://generic-research/${encodeURIComponent(envelope.run.id)}/research-plan.md`,
    metadata: {
      objective,
      constraintCount: constraints.length,
      preferenceCount: preferences.length,
      deterministic: true,
      networkAccess: "denied",
      purchasing: "out-of-scope"
    }
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          objective,
          decisionDeadline: deadline,
          planMarkdown: markdown,
          boundaries: ["No purchasing", "No form submission", "No credentialed browsing", "No unattended network write"]
        },
        {
          artifacts: [artifact]
        }
      )
    )
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

async function readStdin() {
  let body = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    body += chunk;
  }
  return body;
}

function toEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).map(([key, raw]) => [key, formatValue(raw)]);
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderPlan({ objective, constraints, preferences, deadline }) {
  return [
    `# Research Plan: ${objective}`,
    "",
    `Decision deadline: ${deadline}`,
    "",
    "## Boundaries",
    "",
    "- No purchasing or checkout flows.",
    "- No form submission.",
    "- No credentialed browsing or scraping.",
    "- Use approved future permissions before external web access.",
    "",
    "## Constraints",
    "",
    ...(constraints.length > 0 ? constraints.map(([key, value]) => `- ${key}: ${value}`) : ["- None provided."]),
    "",
    "## Preferences",
    "",
    ...(preferences.length > 0 ? preferences.map(([key, value]) => `- ${key}: ${value}`) : ["- None provided."]),
    "",
    "## Research Steps",
    "",
    "1. Convert the objective into measurable selection criteria.",
    "2. Identify candidate sources or products only through approved read-only inputs.",
    "3. Compare candidates against constraints first, then preferences.",
    "4. Capture evidence, tradeoffs, and unresolved questions before recommending a next action.",
    "5. Ask for explicit operator approval before any purchase, account action, or network-write step."
  ].join("\n");
}
