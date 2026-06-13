import { describe, expect, it } from "vitest";
import {
  EVIDENCE_BUNDLE_REDACTION_TEXT,
  EVIDENCE_BUNDLE_SCHEMA_VERSION,
  redactEvidenceBundleValue,
  type EvidenceBundle
} from "../src/shared/contracts/evidence-bundle.js";

describe("evidence bundle contracts", () => {
  it("defines a portable v1 bundle shape", () => {
    const bundle: EvidenceBundle = {
      manifest: {
        schemaVersion: EVIDENCE_BUNDLE_SCHEMA_VERSION,
        bundleId: "bundle-run-1",
        createdAt: "2026-06-13T00:00:00.000Z",
        source: {
          product: "team-orchestrator",
          version: "0.1.0",
          workspaceId: "default"
        },
        run: {
          run: {
            id: "run-1",
            targetType: "task",
            targetId: "task-1",
            workspaceId: "default",
            status: "completed",
            output: { summary: "Done" },
            createdAt: "2026-06-13T00:00:00.000Z",
            updatedAt: "2026-06-13T00:00:01.000Z"
          },
          provider: {
            providerId: "fixture-openai",
            providerKind: "openai-compatible",
            model: "gpt-fixture",
            secretRef: {
              kind: "local-file",
              name: "/run/secrets/provider-key",
              configured: true
            }
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15
          }
        },
        redaction: {
          strategy: "secret-key-recursive",
          redactedFields: []
        },
        checksums: {
          manifest: { algorithm: "sha256", value: "abc" },
          entries: []
        }
      },
      events: [],
      artifacts: [
        {
          id: "artifact-1",
          metadata: {
            id: "artifact-1",
            runId: "run-1",
            label: "Summary",
            kind: "primary",
            format: "markdown",
            storageUri: "memory://summary.md",
            metadata: { contentKey: "markdown" },
            createdAt: "2026-06-13T00:00:01.000Z"
          },
          payload: {
            kind: "artifact-ref",
            storageUri: "memory://summary.md",
            mediaType: "text/markdown",
            checksum: { algorithm: "sha256", value: "def" }
          },
          checksum: { algorithm: "sha256", value: "def" }
        }
      ],
      memory: []
    };

    expect(bundle.manifest.schemaVersion).toBe("team-orchestrator.evidence-bundle.v1");
    expect(bundle.artifacts[0]?.payload).toMatchObject({
      kind: "artifact-ref",
      checksum: { algorithm: "sha256" }
    });
  });

  it("redacts secret-shaped fields recursively", () => {
    const { value, report } = redactEvidenceBundleValue({
      provider: {
        providerId: "fixture-openai",
        apiKey: "sk-test",
        secretRef: {
          kind: "local-file",
          name: "/run/secrets/provider-key"
        }
      },
      events: [
        {
          payload: {
            Authorization: "Bearer secret",
            nested: {
              durableMemoryToken: "memory-token",
              harmless: "keep me"
            }
          }
        }
      ]
    });

    expect(value).toEqual({
      provider: {
        providerId: "fixture-openai",
        apiKey: EVIDENCE_BUNDLE_REDACTION_TEXT,
        secretRef: EVIDENCE_BUNDLE_REDACTION_TEXT
      },
      events: [
        {
          payload: {
            Authorization: EVIDENCE_BUNDLE_REDACTION_TEXT,
            nested: {
              durableMemoryToken: EVIDENCE_BUNDLE_REDACTION_TEXT,
              harmless: "keep me"
            }
          }
        }
      ]
    });
    expect(report.redactedFields).toEqual([
      "$.provider.apiKey",
      "$.provider.secretRef",
      "$.events[0].payload.Authorization",
      "$.events[0].payload.nested.durableMemoryToken"
    ]);
  });
});
