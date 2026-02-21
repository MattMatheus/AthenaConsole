import { describe, expect, it } from "vitest";
import { APIRouter, type RouteTable } from "../src/api/router.js";

describe("api router", () => {
  it("dispatches exact route handlers", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "GET",
        path: "/api/v1/capabilities",
        handler(context) {
          context.calls.push("capabilities");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "GET",
      path: "/api/v1/capabilities",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["capabilities"]);
  });

  it("supports basic path parameters", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "POST",
        path: "/api/v1/runs/:sessionId/cancel",
        handler(context, params) {
          context.calls.push(params.sessionId ?? "missing");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "POST",
      path: "/api/v1/runs/session-123/cancel",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["session-123"]);
  });

  it("extracts multiple path parameters", async () => {
    let extracted = "";
    const routes: RouteTable<{ setValue(value: string): void }> = [
      {
        method: "GET",
        path: "/api/v1/work/:sessionId/items/:itemId",
        handler(context, params) {
          context.setValue(`${params.sessionId}:${params.itemId}`);
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "GET",
      path: "/api/v1/work/s-1/items/i-9",
      context: {
        setValue(value) {
          extracted = value;
        }
      }
    });

    expect(handled).toBe(true);
    expect(extracted).toBe("s-1:i-9");
  });

  it("uses deterministic first-match precedence", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "POST",
        path: "/api/v1/schedules/tick",
        handler(context) {
          context.calls.push("tick");
        }
      },
      {
        method: "POST",
        path: "/api/v1/schedules/:id",
        handler(context, params) {
          context.calls.push(`dynamic:${params.id}`);
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "POST",
      path: "/api/v1/schedules/tick",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["tick"]);
  });

  it("prioritizes static routes over parameterized routes regardless of registration order", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "POST",
        path: "/api/v1/schedules/:id",
        handler(context, params) {
          context.calls.push(`dynamic:${params.id}`);
        }
      },
      {
        method: "POST",
        path: "/api/v1/schedules/tick",
        handler(context) {
          context.calls.push("tick");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "POST",
      path: "/api/v1/schedules/tick",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["tick"]);
  });

  it("uses deterministic precedence across mixed static/parameterized segment patterns", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "GET",
        path: "/api/v1/a/:b/:c",
        handler(context) {
          context.calls.push("two-params");
        }
      },
      {
        method: "GET",
        path: "/api/v1/a/:b/c",
        handler(context) {
          context.calls.push("trailing-static");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "GET",
      path: "/api/v1/a/one/c",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["trailing-static"]);
  });

  it("uses deterministic lexical tie-break for equal-specificity parameter routes", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "GET",
        path: "/api/v1/a/:name",
        handler(context) {
          context.calls.push("name");
        }
      },
      {
        method: "GET",
        path: "/api/v1/a/:id",
        handler(context) {
          context.calls.push("id");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "GET",
      path: "/api/v1/a/value",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["id"]);
  });

  it("does not match when method differs for the same path", async () => {
    const routes: RouteTable<{}> = [
      {
        method: "GET",
        path: "/api/v1/capabilities",
        handler() {
          throw new Error("should not be called");
        }
      }
    ];
    const router = new APIRouter(routes);

    const match = router.findMatch("POST", "/api/v1/capabilities");
    const handled = await router.dispatch({
      method: "POST",
      path: "/api/v1/capabilities",
      context: {}
    });

    expect(match).toBeUndefined();
    expect(handled).toBe(false);
  });

  it("does not match when path segment count differs", () => {
    const routes: RouteTable<{}> = [
      {
        method: "GET",
        path: "/api/v1/sessions/:sessionId/transcript",
        handler() {}
      }
    ];
    const router = new APIRouter(routes);

    expect(router.findMatch("GET", "/api/v1/sessions/s1")).toBeUndefined();
    expect(router.findMatch("GET", "/api/v1/sessions/s1/transcript/extra")).toBeUndefined();
  });

  it("does not match routes with invalid parameter keys", () => {
    const routes: RouteTable<{}> = [
      {
        method: "GET",
        path: "/api/v1/runs/:/cancel",
        handler() {}
      }
    ];
    const router = new APIRouter(routes);

    expect(router.findMatch("GET", "/api/v1/runs/s1/cancel")).toBeUndefined();
  });

  it("normalizes leading and trailing slashes during matching", () => {
    const routes: RouteTable<{}> = [
      {
        method: "GET",
        path: "api/v1/capabilities/",
        handler() {}
      }
    ];
    const router = new APIRouter(routes);

    const match = router.findMatch("GET", "/api/v1/capabilities");
    expect(match?.params).toEqual({});
  });

  it("awaits async handlers before returning", async () => {
    const calls: string[] = [];
    const routes: RouteTable<{ calls: string[] }> = [
      {
        method: "GET",
        path: "/api/v1/capabilities",
        async handler(context) {
          await Promise.resolve();
          context.calls.push("done");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "GET",
      path: "/api/v1/capabilities",
      context: { calls }
    });

    expect(handled).toBe(true);
    expect(calls).toEqual(["done"]);
  });

  it("returns false when no route matches", async () => {
    const routes: RouteTable<{}> = [
      {
        method: "GET",
        path: "/api/v1/capabilities",
        handler() {
          throw new Error("should not be called");
        }
      }
    ];
    const router = new APIRouter(routes);

    const handled = await router.dispatch({
      method: "POST",
      path: "/api/v1/capabilities",
      context: {}
    });

    expect(handled).toBe(false);
  });
});
