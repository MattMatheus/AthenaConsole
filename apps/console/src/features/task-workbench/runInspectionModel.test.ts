import { describe, expect, it } from "vitest";
import {
  artifactPreviewState,
  classifyRunEvent,
  formatBytes,
  formatUnknown,
  formatVerificationFailureDetails,
  isProposedChangeArtifact,
  modelProviderRunMetadata,
  modelRunOutput,
  proposedChangeArtifact,
  runStatusTone,
  verificationStatusLabel,
  verificationStatusTone,
} from "./runInspectionModel";

describe("task run inspection model", () => {
  it("classifies lifecycle, log, and artifact events", () => {
    expect(classifyRunEvent({ type: "run.log" })).toBe("log");
    expect(classifyRunEvent({ type: "artifact.created" })).toBe("artifact");
    expect(classifyRunEvent({ type: "run.completed" })).toBe("lifecycle");
  });

  it("maps terminal and waiting states to inspection tones", () => {
    expect(runStatusTone("completed")).toBe("success");
    expect(runStatusTone("failed")).toBe("danger");
    expect(runStatusTone("cancelled")).toBe("danger");
    expect(runStatusTone("stopped-by-limit")).toBe("danger");
    expect(runStatusTone("waiting-for-approval")).toBe("warning");
    expect(runStatusTone("running")).toBe("running");
    expect(runStatusTone("queued")).toBe("neutral");
  });

  it("formats JSON output and artifact sizes predictably", () => {
    expect(formatUnknown({ summary: "done" })).toBe("{\n  \"summary\": \"done\"\n}");
    expect(formatUnknown("plain text")).toBe("plain text");
    expect(formatBytes(undefined)).toBe("not recorded");
    expect(formatBytes(42)).toBe("42 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats verification status and failure details for inspection", () => {
    expect(verificationStatusLabel("passed")).toBe("passed");
    expect(verificationStatusLabel("verification-failed")).toBe("verification failed");
    expect(verificationStatusLabel(undefined)).toBe("not evaluated");
    expect(verificationStatusTone("passed")).toBe("success");
    expect(verificationStatusTone("verification-failed")).toBe("danger");
    expect(verificationStatusTone(undefined)).toBe("neutral");
    expect(
      formatVerificationFailureDetails({
        details: {
          label: "test-report",
          evidenceType: "json",
        },
      })
    ).toBe("label: test-report\nevidenceType: json");
    expect(formatVerificationFailureDetails({})).toBe("No details recorded.");
  });

  it("normalizes proposed-change artifacts for diff inspection", () => {
    const artifact = {
      kind: "proposed-change",
      format: "diff",
      metadata: {
        artifactType: "proposed-changes",
        summary: "Two edits proposed.",
        applyAvailable: false,
        proposedChanges: [
          {
            path: "src/app.ts",
            changeType: "modify",
            diff: "@@ -1 +1 @@\n-old\n+new",
          },
        ],
      },
    };

    expect(isProposedChangeArtifact(artifact)).toBe(true);
    expect(proposedChangeArtifact(artifact)).toEqual({
      summary: "Two edits proposed.",
      applyAvailable: false,
      changes: [
        {
          path: "src/app.ts",
          changeType: "modify",
          diff: "@@ -1 +1 @@\n-old\n+new",
        },
      ],
    });
  });

  it("classifies artifact preview availability before opening", () => {
    expect(
      artifactPreviewState({
        storageUri: "memory://first-run-demo/run-1/verify.json",
        format: "json",
        metadata: {},
      }),
    ).toMatchObject({
      status: "available",
      label: "Preview available",
      canOpen: true,
    });
    expect(
      artifactPreviewState({
        storageUri: "memory://first-run-demo/run-1/../secret.json",
        format: "json",
        metadata: {},
      }),
    ).toMatchObject({
      status: "blocked",
      label: "Preview blocked",
      canOpen: false,
    });
    expect(
      artifactPreviewState({
        storageUri: "remote://bucket/run-1/report.md",
        format: "markdown",
        metadata: {},
      }),
    ).toMatchObject({
      status: "unsupported",
      label: "Unsupported preview",
      canOpen: false,
    });
    expect(
      artifactPreviewState({
        storageUri: "memory://demo/run-1/metadata.json",
        format: "json",
        metadata: { metadataOnly: true },
      }),
    ).toMatchObject({
      status: "metadata-only",
      label: "Metadata only",
      canOpen: false,
    });
  });

  it("extracts model provider metadata and model output without secrets", () => {
    expect(
      modelProviderRunMetadata([
        {
          type: "run.model_provider",
          payload: {
            providerId: "deepseek-local",
            providerKind: "openai-compatible",
            baseUrl: "https://api.deepseek.com",
            model: "deepseek-chat",
            apiKey: "should-not-be-read",
          },
        },
      ])
    ).toEqual({
      providerId: "deepseek-local",
      providerKind: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
    });

    expect(
      modelRunOutput({
        providerId: "deepseek-local",
        providerKind: "openai-compatible",
        model: "deepseek-chat",
        response: "Hello from the model.",
        usage: { total_tokens: 12 },
      })
    ).toEqual({
      providerId: "deepseek-local",
      providerKind: "openai-compatible",
      model: "deepseek-chat",
      response: "Hello from the model.",
      usage: { total_tokens: 12 },
    });
  });
});
