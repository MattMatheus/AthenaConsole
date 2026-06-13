#!/usr/bin/env node

const mode = process.argv[2] ?? "repo-context";
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const envelope = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
const inputs = isRecord(envelope.task?.inputs) ? envelope.task.inputs : isRecord(envelope.inputs) ? envelope.inputs : {};
const repository = inputs.repository ?? "octo-org/widget";
const fixture = githubFixture(repository);

const renderers = {
  "repo-context": () => repoContext(fixture, inputs),
  "issue-triage": () => issueTriage(fixture, inputs),
  "pr-summary": () => prSummary(fixture, inputs),
  "pr-review-support": () => prReviewSupport(fixture, inputs),
  "release-notes-draft": () => releaseNotesDraft(fixture, inputs),
  "approved-write": () => approvedWrite(fixture, inputs)
};

const rendered = (renderers[mode] ?? renderers["repo-context"])();
process.stdout.write(
  JSON.stringify(
    {
      status: "completed",
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
            repository,
            mode,
            liveNetwork: false,
            externalWritePublished: false
          }
        }
      ]
    },
    null,
    2
  )
);

function repoContext(fixture, inputs) {
  return artifact("github_repo_context", "GitHub repo context", [
    "# GitHub Repository Context",
    "",
    `Repository: ${fixture.repository.fullName}`,
    `Default branch: ${fixture.repository.defaultBranch}`,
    `Open issues: ${fixture.issues.length}`,
    `Open pull requests: ${fixture.pullRequests.length}`,
    `Recent commits: ${fixture.commits.length}`,
    `Latest release: ${fixture.releases[0].tag}`,
    "",
    "Focus:",
    inputs.focus ?? "General repository orientation.",
    "",
    "No live network calls were made."
  ]);
}

function issueTriage(fixture) {
  const rows = fixture.issues.map((issue) => `- #${issue.number} ${issue.title}: priority=${issue.priority}; suggested labels=${issue.labels.join(", ")}`);
  return artifact("issue_triage", "Issue triage suggestions", [
    "# GitHub Issue Triage",
    "",
    ...rows,
    "",
    "Suggestions only. No labels were applied."
  ]);
}

function prSummary(fixture, inputs) {
  const pr = fixture.pullRequests.find((candidate) => candidate.number === Number(inputs.pullRequest)) ?? fixture.pullRequests[0];
  return artifact("pr_summary", "PR summary", [
    "# GitHub PR Summary",
    "",
    `PR #${pr.number}: ${pr.title}`,
    `Author: ${pr.author}`,
    `Changed files: ${pr.changedFiles.join(", ")}`,
    `Review state: ${pr.reviewState}`,
    "",
    `Risk note: ${pr.risk}`
  ]);
}

function prReviewSupport(fixture, inputs) {
  const pr = fixture.pullRequests.find((candidate) => candidate.number === Number(inputs.pullRequest)) ?? fixture.pullRequests[0];
  return artifact("pr_review_support", "PR review support", [
    "# GitHub PR Review Support",
    "",
    `PR #${pr.number}: ${pr.title}`,
    "",
    "Findings:",
    "- Verify import boundary handling for empty repositories.",
    "- Confirm connector fixture output does not imply a posted review.",
    "",
    "Suggested comment drafts:",
    "- Draft only: Could we add an empty-repository fixture before merging?",
    "",
    "No GitHub comments were posted."
  ]);
}

function releaseNotesDraft(fixture, inputs) {
  return artifact("release_notes_draft", "Release notes draft", [
    "# Release Notes Draft",
    "",
    `Release: ${inputs.releaseName ?? "fixture-release"}`,
    `Repository: ${fixture.repository.fullName}`,
    "",
    "Highlights:",
    "- Added fixture-backed GitHub connector read workflows.",
    "- Added issue, PR, and release drafting agents.",
    "- Kept write actions approval-gated.",
    "",
    "Included PRs:",
    ...fixture.pullRequests.map((pr) => `- #${pr.number} ${pr.title}`),
    "",
    "Draft only. No GitHub release was created."
  ]);
}

function approvedWrite(fixture, inputs) {
  const approved = inputs.writeScenario === "write-approved";
  return artifact("approved_write", "Approved write fixture", [
    "# GitHub Approved Write Fixture",
    "",
    `Repository: ${fixture.repository.fullName}`,
    `Scenario: ${inputs.writeScenario ?? "write-blocked"}`,
    `Approval: ${approved ? "present" : "missing"}`,
    "",
    approved
      ? "Fixture result: approved write would create a draft comment artifact for operator review."
      : "Fixture result: external write remains blocked until approval evidence is present.",
    "",
    "No GitHub write was published."
  ]);
}

function artifact(artifactId, label, lines) {
  return {
    artifactId,
    label,
    markdown: lines.join("\n")
  };
}

function githubFixture(repository) {
  return {
    repository: {
      fullName: repository,
      defaultBranch: "main"
    },
    issues: [
      { number: 41, title: "Import flow fails on empty repository", priority: "high", labels: ["bug", "import"] },
      { number: 42, title: "Document connector token setup", priority: "medium", labels: ["docs", "connector"] }
    ],
    pullRequests: [
      {
        number: 17,
        title: "Add connector fixture validation",
        author: "octocat",
        changedFiles: ["packages/core/scripts/validate-pack-fixtures.ts", "bundled-plugins/github/plugin.yaml"],
        reviewState: "changes-requested",
        risk: "Fixture wording must not imply live GitHub writes."
      }
    ],
    commits: [
      { sha: "abc1234", message: "Add GitHub connector pack fixture" },
      { sha: "def5678", message: "Document read-only GitHub workflows" }
    ],
    releases: [{ tag: "v2026.2-fixture", name: "2026.2 Fixture" }]
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
