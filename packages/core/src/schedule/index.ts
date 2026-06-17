import { AthenaError } from "../runtime/errors.js";

export type { RunScheduleResult, UpsertScheduleRequest } from "../shared/contracts/schedule.js";

const SCHEDULE_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/;

export function assertValidScheduleId(scheduleId: string): void {
  if (!SCHEDULE_ID_PATTERN.test(scheduleId)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `Invalid schedule id '${scheduleId}'. Allowed pattern: ${SCHEDULE_ID_PATTERN.source}`
    );
  }
}
