let raw = "";

process.stdin.on("data", (chunk) => {
  raw += chunk;
});

process.stdin.on("end", () => {
  const envelope = JSON.parse(raw || "{}");
  const task = envelope.task || {};
  const provenance = task.provenance || {};
  const stepId = provenance.workflowDagStepId || task.id || "unknown";
  const demoName = readString(task.inputs && task.inputs.demoName, "First-Run Demo");
  const stepPurpose = readString(task.inputs && task.inputs.stepPurpose, "Demonstrate local workflow execution.");
  const runId = envelope.run && envelope.run.id ? String(envelope.run.id) : "run";
  const artifactId = `first-run-demo-${runId}-${stepId}`;

  process.stdout.write(
    JSON.stringify({
      output: {
        demoName,
        stepId,
        taskId: task.id,
        stepPurpose,
        message: `${demoName}: ${stepId} completed locally.`
      },
      artifacts: [
        {
          id: artifactId,
          label: `First-run demo evidence: ${stepId}`,
          kind: "supporting",
          format: "json",
          storageUri: `memory://first-run-demo/${runId}/${stepId}.json`,
          metadata: {
            demoName,
            stepId,
            taskId: task.id,
            deterministic: true
          }
        }
      ]
    })
  );
});

function readString(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
