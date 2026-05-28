import { describe, expect, it } from "vitest";
import {
  buildRunTemplateCreateRequest,
  buildTemplateRunRequest,
  extractDirectivePlaceholders,
  formatKeyValueLines,
  parseKeyValueLines,
  summarizeParams,
} from "./formModel";

describe("run template form model", () => {
  it("parses and formats KEY=value parameter lines", () => {
    expect(parseKeyValueLines("HEAD_REF= feature/a\nBASE_REF=main")).toEqual({
      values: {
        HEAD_REF: "feature/a",
        BASE_REF: "main",
      },
      errors: [],
    });
    expect(formatKeyValueLines({ HEAD_REF: "feature/a", BASE_REF: "main" })).toBe("BASE_REF=main\nHEAD_REF=feature/a");
    expect(summarizeParams({ HEAD_REF: "feature/a" })).toBe("1 param");
  });

  it("validates parameter lines", () => {
    expect(parseKeyValueLines("head=main\nEMPTY=")).toEqual({
      values: {},
      errors: [
        "Line 1 key must use uppercase letters, numbers, or underscores.",
        "Line 2 is missing a value.",
      ],
    });
  });

  it("extracts directive placeholders", () => {
    expect(extractDirectivePlaceholders("Review {{ HEAD_REF }} against {{BASE_REF}} and {{HEAD_REF}}")).toEqual([
      "BASE_REF",
      "HEAD_REF",
    ]);
  });

  it("builds create requests and requires defaults for placeholders", () => {
    expect(
      buildRunTemplateCreateRequest({
        harnessProfileId: " hp-1 ",
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParamsText: "HEAD_REF=main\nBASE_REF=origin/main",
      }),
    ).toEqual({
      request: {
        harnessProfileId: "hp-1",
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParams: {
          HEAD_REF: "main",
          BASE_REF: "origin/main",
        },
      },
      errors: {},
    });

    expect(
      buildRunTemplateCreateRequest({
        harnessProfileId: "hp-1",
        directiveTemplate: "Review {{HEAD_REF}} against {{BASE_REF}}",
        defaultParamsText: "HEAD_REF=main",
      }).errors.defaultParams,
    ).toBe("Default params must include: BASE_REF.");
  });

  it("builds run requests with optional session and override params", () => {
    expect(buildTemplateRunRequest({ sessionId: " session-1 ", overrideParamsText: "HEAD_REF=feature/a" })).toEqual({
      request: {
        sessionId: "session-1",
        params: {
          HEAD_REF: "feature/a",
        },
      },
      errors: {},
    });
    expect(buildTemplateRunRequest({ sessionId: "", overrideParamsText: "" })).toEqual({
      request: {},
      errors: {},
    });
  });
});
