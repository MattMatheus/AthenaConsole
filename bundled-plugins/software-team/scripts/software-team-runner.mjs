const mode = process.argv[2] ?? "repo-summary";
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const envelopeText = Buffer.concat(chunks).toString("utf8").trim();
const envelope = envelopeText ? JSON.parse(envelopeText) : {};
const inputs = isRecord(envelope.task?.inputs)
  ? envelope.task.inputs
  : isRecord(envelope.inputs)
    ? envelope.inputs
    : {};

const modes = {
  "repo-summary": {
    title: "Repository Summary",
    summary: `Repository summary prepared for ${text(inputs.repositoryPath, "the supplied repository")}.`,
    sections: ["Repository shape", "Notable evidence", "Suggested next inspection"]
  },
  "docs-audit": {
    title: "Docs Audit",
    summary: `Documentation audit prepared for ${text(inputs.docsPath, "the supplied docs")}.`,
    sections: ["Coverage signals", "Gaps to review", "Maintenance suggestions"]
  },
  "code-review": {
    title: "Code Review Notes",
    summary: "Code review support notes prepared from supplied diff evidence.",
    sections: ["Change summary", "Review focus", "Risks to verify"]
  },
  "test-failure": {
    title: "Test Failure Explanation",
    summary: "Test failure explanation prepared from supplied logs.",
    sections: ["Failure signal", "Likely cause", "Next diagnostic steps"]
  },
  changelog: {
    title: "Changelog Draft",
    summary: `Changelog draft prepared for ${text(inputs.releaseName, "the target release")}.`,
    sections: ["Highlights", "Fixes and quality", "Operator review notes"]
  },
  "release-readiness": {
    title: "Release Readiness Review",
    summary: `Release readiness notes prepared for ${text(inputs.releaseName, "the target release")}.`,
    sections: ["Readiness signals", "Open risks", "Recommended operator checks"]
  }
};

const profile = modes[mode] ?? modes["repo-summary"];
const evidence = [
  inputs.objective,
  inputs.evidence,
  inputs.diff,
  inputs.testLog,
  inputs.changes,
  inputs.scope,
  inputs.memoryContext
].filter((value) => typeof value === "string" && value.trim().length > 0);

const markdown = [
  `# ${profile.title}`,
  "",
  profile.summary,
  "",
  ...profile.sections.flatMap((section, index) => [
    `## ${section}`,
    evidence[index] ? evidence[index] : "No additional local evidence was supplied for this section.",
    ""
  ]),
  "## Safety",
  "This bundled runner is deterministic, local, and does not perform external writes.",
  "",
  "## Memory",
  inputs.memoryContext
    ? "Operator-supplied memory context was included as reviewable local evidence."
    : "No durable-memory context was supplied; deterministic no-memory behavior was used.",
  ""
].join("\n");

process.stdout.write(
  JSON.stringify({
    status: "completed",
    summary: profile.summary,
    output: {
      markdown
    },
    artifacts: []
  })
);

function text(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
