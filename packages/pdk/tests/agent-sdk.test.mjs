import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentSdkValidationError,
  createAgentArtifact,
  createAgentRunOutput,
  parseAgentEnvelopeInputs,
  parseAgentInputs,
  parseAgentTaskRunEnvelope,
  runAgentHandler,
  serializeAgentRunOutput
} from "../dist/index.js";

const inputContract = {
  topic: { type: "string", required: true },
  limit: { type: "integer", default: 5 },
  includeLinks: { type: "boolean" },
  mode: { type: "enum", enum: ["short", "deep"], default: "short" }
};

const envelope = {
  task: {
    id: "task-1",
    title: "Summarize article",
    inputs: {
      topic: "workspace notes",
      includeLinks: true
    }
  },
  agent: {
    id: "demo.article-summarizer",
    version: "0.1.0"
  },
  run: {
    id: "run-1"
  }
};

test("parses task run envelopes from JSON strings", () => {
  assert.deepEqual(parseAgentTaskRunEnvelope(JSON.stringify(envelope)), envelope);
});

test("validates manifest-shaped input contracts and applies defaults", () => {
  assert.deepEqual(parseAgentEnvelopeInputs(envelope, inputContract), {
    topic: "workspace notes",
    limit: 5,
    includeLinks: true,
    mode: "short"
  });
});

test("reports structured input validation failures", () => {
  assert.throws(
    () => parseAgentInputs(inputContract, { limit: 1 }),
    (error) => {
      assert.ok(error instanceof AgentSdkValidationError);
      assert.deepEqual(error.issues, [{ path: "topic", message: "task.inputs.topic is required." }]);
      return true;
    }
  );
});

test("creates valid run outputs and artifacts", () => {
  const output = createAgentRunOutput(
    { summary: "Done" },
    {
      artifacts: [
        createAgentArtifact({
          label: "Summary",
          kind: "primary",
          format: "markdown",
          storageUri: "artifacts/summary.md",
          metadata: { source: "test" }
        })
      ],
      verificationStatus: "passed"
    }
  );

  assert.deepEqual(output, {
    output: { summary: "Done" },
    artifacts: [
      {
        label: "Summary",
        kind: "primary",
        format: "markdown",
        storageUri: "artifacts/summary.md",
        metadata: { source: "test" }
      }
    ],
    verificationStatus: "passed"
  });
  assert.equal(serializeAgentRunOutput(output), `${JSON.stringify(output)}\n`);
});

test("runs agent handlers with parsed and typed inputs", async () => {
  const result = await runAgentHandler(
    async ({ inputs, task, run }) =>
      createAgentRunOutput({
        taskId: task.id,
        runId: run.id,
        topic: inputs.topic,
        mode: inputs.mode
      }),
    {
      envelope: JSON.stringify(envelope),
      inputContract
    }
  );

  assert.deepEqual(result, {
    output: {
      taskId: "task-1",
      runId: "run-1",
      topic: "workspace notes",
      mode: "short"
    },
    artifacts: []
  });
});
