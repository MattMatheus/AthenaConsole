import { describe, expect, it } from "vitest";
import {
  optionalBoolean,
  optionalString,
  parseJsonObject,
  requireMode,
  requirePositiveInt,
  requireString
} from "../src/api/validation.js";

describe("api validation helpers", () => {
  it("parses and validates required fields", () => {
    const body = parseJsonObject(
      {
        sessionId: "s1",
        payload: "hello",
        everyMinutes: 10,
        mode: "followup"
      },
      "request.body"
    );

    expect(requireString(body, "sessionId", "test")).toBe("s1");
    expect(requireString(body, "payload", "test")).toBe("hello");
    expect(requirePositiveInt(body, "everyMinutes", "test")).toBe(10);
    expect(requireMode(body, "mode", "test")).toBe("followup");
  });

  it("supports optional fields", () => {
    const body = parseJsonObject(
      {
        reason: "  done ",
        enabled: true
      },
      "request.body"
    );

    expect(optionalString(body, "reason", "test")).toBe("done");
    expect(optionalBoolean(body, "enabled", "test")).toBe(true);
    expect(optionalString(body, "missing", "test")).toBeUndefined();
    expect(optionalBoolean(body, "missing", "test")).toBeUndefined();
  });

  it("rejects invalid field types with config errors", () => {
    const body = parseJsonObject(
      {
        sessionId: "",
        mode: "bad",
        everyMinutes: 0,
        enabled: "true"
      },
      "request.body"
    );

    expect(() => requireString(body, "sessionId", "test")).toThrow("test.sessionId");
    expect(() => requireMode(body, "mode", "test")).toThrow("test.mode");
    expect(() => requirePositiveInt(body, "everyMinutes", "test")).toThrow("test.everyMinutes");
    expect(() => optionalBoolean(body, "enabled", "test")).toThrow("test.enabled");
  });
});
