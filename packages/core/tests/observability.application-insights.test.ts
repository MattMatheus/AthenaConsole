import { describe, expect, it } from "vitest";
import { resolvePersonaId, resolveRunId, resolveTenantId } from "../src/observability/application-insights.js";

describe("application insights observability helpers", () => {
  it("resolves tenant id from athena tenant header", () => {
    const tenantId = resolveTenantId({
      headers: {
        "x-athena-tenant-id": "tenant-a"
      }
    } as never);
    expect(tenantId).toBe("tenant-a");
  });

  it("prefers path params for runId and personaId dimensions", () => {
    const requestUrl = new URL("http://localhost/api/v1/runs/active?runId=query-run&personaId=query-persona");
    expect(resolveRunId({ runId: "path-run" }, requestUrl)).toBe("path-run");
    expect(resolvePersonaId({ personaId: "path-persona" }, requestUrl)).toBe("path-persona");
  });

  it("falls back to query string when params are absent", () => {
    const requestUrl = new URL("http://localhost/api/v1/runs/active?runId=query-run&personaId=query-persona");
    expect(resolveRunId({}, requestUrl)).toBe("query-run");
    expect(resolvePersonaId({}, requestUrl)).toBe("query-persona");
  });
});
