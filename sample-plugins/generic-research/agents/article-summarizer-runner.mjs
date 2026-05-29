import { readFile } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import {
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentTaskRunEnvelope,
  serializeAgentRunOutput
} from "@athena/pdk";

const inputContract = {
  article: {
    type: "object"
  },
  text: {
    type: "markdown"
  },
  maxBullets: {
    type: "integer",
    default: 5
  }
};

try {
  const envelope = parseAgentTaskRunEnvelope(await readStdin());
  const inputs = parseAgentEnvelopeInputs(envelope, inputContract);
  const source = await resolveArticleSource(inputs);
  const maxBullets = clampMaxBullets(inputs.maxBullets);
  const sentences = splitSentences(source.text);
  const bullets = sentences.slice(0, maxBullets);
  const markdown = renderSummary({
    title: source.title,
    sourceLabel: source.sourceLabel,
    bullets,
    wordCount: countWords(source.text)
  });

  const artifact = createAgentArtifact({
    id: `article-summary-${envelope.run.id}`,
    label: `Article summary: ${source.title}`,
    kind: "primary",
    format: "markdown",
    storageUri: `memory://generic-research/${encodeURIComponent(envelope.run.id)}/article-summary.md`,
    metadata: {
      title: source.title,
      sourceLabel: source.sourceLabel,
      wordCount: countWords(source.text),
      deterministic: true,
      networkAccess: "denied"
    }
  });

  process.stdout.write(
    serializeAgentRunOutput(
      createAgentRunOutput(
        {
          title: source.title,
          sourceLabel: source.sourceLabel,
          bulletCount: bullets.length,
          summaryMarkdown: markdown
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

async function resolveArticleSource(inputs) {
  const article = inputs.article && typeof inputs.article === "object" && !Array.isArray(inputs.article) ? inputs.article : {};
  const title = readString(article.title, "Untitled Article");
  const directText = readString(article.text, readString(inputs.text, ""));
  if (directText) {
    return {
      title,
      sourceLabel: readString(article.url, "provided text"),
      text: directText
    };
  }

  const path = readString(article.path, "");
  if (path) {
    const resolved = isAbsolute(path) ? resolve(path) : resolve(process.cwd(), path);
    return {
      title: title === "Untitled Article" ? basename(resolved) : title,
      sourceLabel: resolved,
      text: await readFile(resolved, "utf8")
    };
  }

  throw new Error("Provide article.text, text, or article.path for summarization.");
}

function clampMaxBullets(value) {
  return Number.isInteger(value) ? Math.min(10, Math.max(1, value)) : 5;
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function renderSummary({ title, sourceLabel, bullets, wordCount }) {
  return [
    `# Article Summary: ${title}`,
    "",
    `Source: ${sourceLabel}`,
    `Words: ${wordCount}`,
    "",
    "## Key Points",
    "",
    ...(bullets.length > 0 ? bullets.map((sentence) => `- ${sentence}`) : ["- No summary content available."]),
    "",
    "## Boundaries",
    "",
    "- No network access was used.",
    "- This deterministic example summarizes only provided local input."
  ].join("\n");
}

function readString(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
