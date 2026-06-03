const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}

const envelopeText = Buffer.concat(chunks).toString("utf8").trim();
const envelope = envelopeText ? JSON.parse(envelopeText) : {};
const inputs = envelope.inputs ?? {};
const releaseName = typeof inputs.releaseName === "string" ? inputs.releaseName : "unknown-release";

process.stdout.write(
  JSON.stringify({
    status: "completed",
    summary: `Release readiness fixture completed for ${releaseName}.`,
    artifacts: []
  })
);
