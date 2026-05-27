import { describe, expect, it } from "vitest";
import { classifyRunEvent, formatBytes, formatUnknown, runStatusTone } from "./runInspectionModel";

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
});
