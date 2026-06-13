#!/usr/bin/env node

const mode = process.argv[2] ?? "issue-context";
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const envelope = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
const inputs = isRecord(envelope.task?.inputs) ? envelope.task.inputs : isRecord(envelope.inputs) ? envelope.inputs : {};
const issueKey = text(inputs.issueKey, "ENG-1842");
const site = text(inputs.site, "https://acme.atlassian.net");
const fixture = jiraFixture(issueKey, site);

const rendered = mode === "issue-search" ? issueSearch(fixture, inputs) : issueContext(fixture, inputs);
process.stdout.write(
  JSON.stringify(
    {
      status: "completed",
      summary: rendered.summary,
      output: {
        mode: "markdown",
        content: rendered.markdown
      },
      artifacts: [
        {
          id: rendered.artifactId,
          label: rendered.label,
          kind: "primary",
          format: "markdown",
          storageUri: `memory://${rendered.artifactId}.md`,
          metadata: {
            site,
            issueKey,
            mode,
            connectorId: "jira.atlassian.com",
            operationId: mode === "issue-search" ? "issue-search" : "issue-read",
            liveNetwork: false,
            externalWritePublished: false
          }
        }
      ],
      events: [
        {
          type: "connector.issue.read",
          payload: {
            serviceId: "jira.atlassian.com",
            connectorId: "jira.atlassian.com",
            operationId: mode === "issue-search" ? "issue-search" : "issue-read",
            operationClass: "read",
            status: "completed",
            issueKey,
            siteHost: safeHost(site),
            liveNetwork: false
          }
        }
      ]
    },
    null,
    2
  )
);

function issueContext(fixture, inputs) {
  const issue = fixture.issue;
  const markdown = [
    "# Jira Issue Context",
    "",
    `Issue: ${issue.key} ${issue.summary}`,
    `Site: ${fixture.site}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority}`,
    `Reporter: ${issue.reporter}`,
    `Assignee: ${issue.assignee}`,
    `Repository: ${text(inputs.repository, issue.repository)}`,
    "",
    "Labels:",
    ...issue.labels.map((label) => `- ${label}`),
    "",
    "Description:",
    issue.description,
    "",
    "Acceptance signals:",
    ...issue.acceptance.map((item) => `- ${item}`),
    "",
    "Focus:",
    text(inputs.focus, "Review implementation risk, ownership, and test coverage."),
    "",
    "No live Jira network calls were made."
  ].join("\n");
  return {
    artifactId: "jira_issue_context",
    label: "Jira issue context",
    summary: `Jira issue context prepared for ${issue.key}.`,
    markdown
  };
}

function issueSearch(fixture) {
  const markdown = [
    "# Jira Issue Search Fixture",
    "",
    `Site: ${fixture.site}`,
    "",
    ...fixture.related.map((issue) => `- ${issue.key} ${issue.summary} (${issue.status})`),
    "",
    "No live Jira network calls were made."
  ].join("\n");
  return {
    artifactId: "jira_issue_search",
    label: "Jira issue search",
    summary: "Jira issue search fixture prepared.",
    markdown
  };
}

function jiraFixture(issueKey, site) {
  return {
    site,
    issue: {
      key: issueKey,
      summary: "Harden import retry behavior for issue tracker context",
      status: "In Progress",
      priority: "High",
      reporter: "Priya",
      assignee: "Devon",
      repository: "acme/widget-service",
      labels: ["connector", "reliability", "jira"],
      description: "Operators need a read-only Jira issue context workflow before enabling live issue tracker integrations.",
      acceptance: [
        "Read issue metadata through scoped connector credentials.",
        "Keep fixture workflows free of live network calls.",
        "Emit connector audit metadata without token values."
      ]
    },
    related: [
      { key: issueKey, summary: "Harden import retry behavior for issue tracker context", status: "In Progress" },
      { key: "ENG-1777", summary: "Document Jira credential binding setup", status: "To Do" }
    ]
  };
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "fixture.local";
  }
}

function text(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
