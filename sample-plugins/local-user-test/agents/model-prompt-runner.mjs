import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput,
} from "@athena/pdk";

const inputContract = {
  prompt: {
    type: "markdown",
    required: true,
  },
  systemPrompt: {
    type: "markdown",
    default:
      "You are a concise assistant testing Team Orchestrator model-provider wiring.",
  },
  maxTokens: {
    type: "integer",
    default: 300,
  },
  temperature: {
    type: "number",
    default: 0.2,
  },
};

try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const provider = readModelProvider(envelope.modelProvider);
  const response = await callOpenAiCompatibleProvider(provider, inputs);
  const markdown = renderMarkdown({
    provider,
    prompt: inputs.prompt,
    content: response.content,
    usage: response.usage,
  });

  const artifact = createAgentArtifact({
    id: `model-response-${envelope.run.id}`,
    label: "Model Response",
    kind: "primary",
    format: "markdown",
    storageUri: `memory://local-user-test/${encodeURIComponent(envelope.run.id)}/response.md`,
    metadata: {
      providerId: provider.id,
      providerKind: provider.providerKind,
      baseUrl: provider.baseUrl,
      model: provider.defaultModel,
      usage: response.usage,
      networkAccess: "model-provider",
    },
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          providerId: provider.id,
          providerKind: provider.providerKind,
          model: provider.defaultModel,
          response: response.content,
          usage: response.usage,
          responseMarkdown: markdown,
        },
        {
          artifacts: [artifact],
        },
      ),
    ),
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
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

function readModelProvider(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model provider runtime config was not provided.");
  }
  const provider = value;
  const id = readRequiredString(provider.id, "modelProvider.id");
  const providerKind = readRequiredString(
    provider.providerKind,
    "modelProvider.providerKind",
  );
  const baseUrl = readRequiredString(
    provider.baseUrl,
    "modelProvider.baseUrl",
  ).replace(/\/+$/, "");
  const defaultModel = readRequiredString(
    provider.defaultModel,
    "modelProvider.defaultModel",
  );
  const apiKey = readRequiredString(provider.apiKey, "modelProvider.apiKey");
  if (providerKind !== "openai-compatible") {
    throw new Error(`Unsupported provider kind: ${providerKind}`);
  }
  return {
    id,
    providerKind,
    baseUrl,
    defaultModel,
    apiKey,
  };
}

async function callOpenAiCompatibleProvider(provider, inputs) {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      messages: [
        {
          role: "system",
          content: String(inputs.systemPrompt),
        },
        {
          role: "user",
          content: String(inputs.prompt),
        },
      ],
      max_tokens: clampInteger(inputs.maxTokens, 1, 2000, 300),
      temperature: clampNumber(inputs.temperature, 0, 2, 0.2),
      stream: false,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Model provider request failed: ${response.status} ${response.statusText} ${body.slice(0, 800)}`,
    );
  }
  const parsed = JSON.parse(body);
  const content = parsed?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Model provider returned an empty response.");
  }
  return {
    content: content.trim(),
    usage: isRecord(parsed.usage) ? parsed.usage : undefined,
  };
}

function renderMarkdown({ provider, prompt, content, usage }) {
  return [
    "# Local user test",
    "",
    `Provider: ${provider.id}`,
    `Model: ${provider.defaultModel}`,
    "",
    "## Prompt",
    "",
    prompt,
    "",
    "## Response",
    "",
    content,
    "",
    "## Usage",
    "",
    usage
      ? "```json\n" + JSON.stringify(usage, null, 2) + "\n```"
      : "No usage payload returned.",
  ].join("\n");
}

function readRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function clampInteger(value, min, max, fallback) {
  return Number.isInteger(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function clampNumber(value, min, max, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
