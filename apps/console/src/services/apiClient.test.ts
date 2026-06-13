import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./apiClient";

describe("ApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends bearer token and identity headers when configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { status: "ok" } })));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "http://api.example",
      apiToken: "0123456789abcdef",
      identity: "console"
    });

    await expect(client.get<{ status: string }>("/v1/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("http://api.example/v1/health", {
      headers: {
        Authorization: "Bearer 0123456789abcdef",
        "x-athena-identity": "console"
      }
    });
  });

  it("preserves structured error details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "CONFIG_ERROR",
              message: "Run readiness blocked.",
              details: {
                kind: "task-run-readiness",
                readiness: {
                  checks: [{ id: "model-provider", status: "blocked", nextStep: "Configure provider." }],
                },
              },
            },
          }),
          { status: 400 },
        ),
      ),
    );

    const client = new ApiClient({ baseUrl: "http://api.example" });
    await expect(client.post("/v1/tasks/task-1/run", {})).rejects.toMatchObject({
      status: 400,
      code: "CONFIG_ERROR",
      details: {
        kind: "task-run-readiness",
        readiness: {
          checks: [{ id: "model-provider", status: "blocked", nextStep: "Configure provider." }],
        },
      },
    });
  });
});
