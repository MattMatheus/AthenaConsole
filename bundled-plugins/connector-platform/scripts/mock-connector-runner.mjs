#!/usr/bin/env node

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const envelope = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
const scenario = envelope.inputs?.scenario ?? "read-success";

const statusByScenario = {
  "read-success": "configured",
  "write-blocked": "blocked",
  "write-approved": "configured",
  "auth-missing": "missing-credentials",
  "scope-missing": "missing-scopes",
  "rate-limited": "rate-limited"
};

const markdown = [
  "# Connector Fixture Report",
  "",
  `Scenario: ${scenario}`,
  `Readiness: ${statusByScenario[scenario] ?? "blocked"}`,
  "Live network: disabled",
  "",
  scenario === "write-approved"
    ? "External write fixture includes approval evidence."
    : scenario === "write-blocked"
      ? "External write fixture is blocked without approval evidence."
      : "No external write is executed."
].join("\n");

process.stdout.write(
  JSON.stringify(
    {
      status: "completed",
      output: {
        mode: "markdown",
        content: markdown
      },
      artifacts: [
        {
          id: "connector-fixture-report",
          label: "Connector fixture report",
          kind: "primary",
          format: "markdown",
          storageUri: "memory://connector-fixture-report.md",
          metadata: {
            scenario,
            liveNetwork: false
          }
        }
      ]
    },
    null,
    2
  )
);
