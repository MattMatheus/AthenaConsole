import { describe, expect, it } from "vitest";
import {
  buildCreateScheduleRequest,
  buildSimpleRRule,
  formatScheduleCadence,
  hasScheduleValidationErrors,
  parseSimpleRRule,
  summarizeScheduleRunLog,
  summarizeScheduleRunResult,
  validateScheduleForm,
} from "./scheduleModel";
import type { ScheduleFormDraft, ScheduledTask } from "./types";

describe("schedule model", () => {
  it("builds one-shot task schedule requests from local datetime values", () => {
    expect(
      buildCreateScheduleRequest({
        ...draft(),
        id: "daily-report",
        name: "Daily report",
        targetId: "task-1",
        mode: "one-shot",
        runAtLocal: "2026-06-01T09:30",
        timezone: "UTC",
      }),
    ).toMatchObject({
      id: "daily-report",
      name: "Daily report",
      targetType: "task",
      targetId: "task-1",
      timezone: "UTC",
      status: "active",
      failurePolicy: { overlap: "skip-if-running" },
      runAt: expect.stringMatching(/^2026-06-01T/),
    });
  });

  it("builds and parses simple RRULE schedules", () => {
    expect(buildSimpleRRule("DAILY", 2)).toBe("FREQ=DAILY;INTERVAL=2");
    expect(parseSimpleRRule("FREQ=WEEKLY;INTERVAL=3")).toEqual({
      frequency: "WEEKLY",
      interval: 3,
    });
    expect(
      buildCreateScheduleRequest({
        ...draft(),
        id: "weekly-check",
        targetId: "task-2",
        mode: "recurring",
        frequency: "WEEKLY",
        interval: "1",
      }),
    ).toMatchObject({
      rrule: "FREQ=WEEKLY;INTERVAL=1",
    });
  });

  it("builds workflow-template schedule requests with input bindings", () => {
    expect(
      buildCreateScheduleRequest(
        {
          ...draft(),
          id: "release-workflow",
          targetType: "workflow-template",
          targetId: "templates.release.workflow",
        },
        {
          inputBindings: {
            version: "0.1.0",
            pluginId: "test.templates",
            pluginVersion: "0.1.0",
            inputs: { releaseName: "v1.2.0" },
          },
        },
      ),
    ).toMatchObject({
      id: "release-workflow",
      targetType: "workflow-template",
      targetId: "templates.release.workflow",
      inputBindings: {
        version: "0.1.0",
        inputs: { releaseName: "v1.2.0" },
      },
    });
  });


  it("validates ids, ready task selection, run times, and intervals", () => {
    const validation = validateScheduleForm({
      ...draft(),
      id: "bad id",
      targetId: "",
      mode: "recurring",
      interval: "0",
    });

    expect(hasScheduleValidationErrors(validation)).toBe(true);
    expect(validation).toMatchObject({
      id: "Use letters, numbers, dots, underscores, or hyphens.",
      targetId: "Choose a ready task.",
      interval: "Use a positive whole number.",
    });
  });

  it("formats schedule cadence and run results", () => {
    expect(formatScheduleCadence(schedule({ rrule: "FREQ=HOURLY;INTERVAL=2" }))).toBe("Every 2 hours");
    expect(formatScheduleCadence(schedule({}))).toBe("One shot");
    expect(
      summarizeScheduleRunResult({
        id: "schedule-1",
        sessionId: "task-1",
        status: "failed",
        startedAt: "2026-06-01T09:00:00.000Z",
        finishedAt: "2026-06-01T09:00:01.000Z",
        reason: "task-run-failed",
      }),
    ).toBe("schedule-1 failed: task-run-failed");
    expect(
      summarizeScheduleRunLog({
        id: "log-1",
        scheduleId: "workflow-schedule",
        sessionId: "mission-1",
        status: "ok",
        startedAt: "2026-06-01T09:00:00.000Z",
        missionId: "mission-1",
        workflowDagRunId: "workflow-dag-run-1",
      }),
    ).toContain("Created mission mission-1.");
    expect(
      summarizeScheduleRunResult({
        id: "workflow-schedule",
        sessionId: "mission-1",
        status: "ok",
        startedAt: "2026-06-01T09:00:00.000Z",
        finishedAt: "2026-06-01T09:00:01.000Z",
        workflowDagRunId: "workflow-dag-run-1",
      }),
    ).toContain("Workflow run workflow-dag-run-1.");
  });
});

function draft(): ScheduleFormDraft {
  return {
    id: "schedule-1",
    name: "",
    targetType: "task",
    targetId: "task-1",
    mode: "one-shot",
    runAtLocal: "2026-06-01T09:00",
    frequency: "DAILY",
    interval: "1",
    timezone: "UTC",
  };
}

function schedule(overrides: Partial<ScheduledTask>): ScheduledTask {
  return {
    id: "schedule-1",
    targetType: "task",
    targetId: "task-1",
    sessionId: "task-1",
    input: "",
    everyMinutes: 1,
    enabled: true,
    running: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    nextRunAt: "2026-06-01T09:00:00.000Z",
    ...overrides,
  };
}
