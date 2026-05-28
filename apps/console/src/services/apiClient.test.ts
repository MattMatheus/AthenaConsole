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
});
