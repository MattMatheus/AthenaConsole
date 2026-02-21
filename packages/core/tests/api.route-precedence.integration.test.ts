import { createServer, type Server, type ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { APIRouter, type RouteTable } from "../src/api/router.js";

describe("api route precedence integration", () => {
  it("routes static paths before parameterized paths for ambiguous URLs", async () => {
    const routes: RouteTable<{ res: ServerResponse }> = [
      {
        method: "GET",
        path: "/api/v1/runs/:id",
        handler(context, params) {
          context.res.writeHead(200, { "content-type": "application/json" });
          context.res.end(JSON.stringify({ route: "dynamic", id: params.id }));
        }
      },
      {
        method: "GET",
        path: "/api/v1/runs/summary",
        handler(context) {
          context.res.writeHead(200, { "content-type": "application/json" });
          context.res.end(JSON.stringify({ route: "summary" }));
        }
      }
    ];

    await withTestServer(routes, async (base) => {
      const response = await fetch(`${base}/api/v1/runs/summary`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { route: string };
      expect(body.route).toBe("summary");
    });
  });

  it("prefers more specific mixed static/parameterized patterns", async () => {
    const routes: RouteTable<{ res: ServerResponse }> = [
      {
        method: "GET",
        path: "/api/v1/a/:b/:c",
        handler(context) {
          context.res.writeHead(200, { "content-type": "application/json" });
          context.res.end(JSON.stringify({ route: "two-params" }));
        }
      },
      {
        method: "GET",
        path: "/api/v1/a/:b/c",
        handler(context) {
          context.res.writeHead(200, { "content-type": "application/json" });
          context.res.end(JSON.stringify({ route: "trailing-static" }));
        }
      }
    ];

    await withTestServer(routes, async (base) => {
      const response = await fetch(`${base}/api/v1/a/value/c`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { route: string };
      expect(body.route).toBe("trailing-static");
    });
  });
});

async function withTestServer(
  routes: RouteTable<{ res: ServerResponse }>,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const router = new APIRouter(routes);
  const server = createServer(async (req, res) => {
    const handled = await router.dispatch({
      method: req.method ?? "GET",
      path: new URL(req.url ?? "/", "http://localhost").pathname,
      context: { res }
    });
    if (!handled) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ route: "not-found" }));
    }
  });

  let bound: { host: string; port: number };
  try {
    bound = await startServer(server);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("EPERM")) {
      return;
    }
    throw error;
  }
  try {
    await run(`http://${bound.host}:${bound.port}`);
  } finally {
    await stopServer(server);
  }
}

function startServer(server: Server): Promise<{ host: string; port: number }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        resolve({ host: "127.0.0.1", port: 0 });
        return;
      }
      resolve({ host: address.address, port: address.port });
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
