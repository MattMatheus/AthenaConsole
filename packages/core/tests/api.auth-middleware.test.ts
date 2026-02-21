import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../src/api/server.js";
import { getRequestAuthContext } from "../src/control-plane/auth.js";
import { createLocalControlPlaneServices } from "../src/control-plane/services.js";
import { loadConfig } from "../src/shared/config.js";

describe("api identity extraction middleware", () => {
  it("rejects requests when identity header is missing in enforce mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-"));
    writeFileSync(join(dir, ".env"), "ATHENA_AUTH_ENABLED=true\nATHENA_AUTHZ_MODE=enforce", "utf8");
    const config = loadConfig(dir);
    const server = createApiServer({ config, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }
      const response = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`);
      expect(response.status).toBe(401);
      const payload = (await response.json()) as {
        ok: boolean;
        error: { code: string; message: string; retryable: boolean; traceId?: string };
      };
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("AUTH_IDENTITY_MISSING");
      expect(payload.error.retryable).toBe(false);
      expect(payload.error.traceId).toBeDefined();
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("maps configured identity to role and propagates context into control-plane services", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Admin,*:Viewer",
        "ATHENA_AUTH_DEFAULT_ROLE=Viewer"
      ].join("\n"),
      "utf8"
    );
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    let observedAuthContext = getRequestAuthContext();
    const baseCapabilityService = services.capabilityService;
    services.capabilityService = {
      async getCapabilities() {
        observedAuthContext = getRequestAuthContext();
        return baseCapabilityService.getCapabilities();
      }
    };

    const server = createApiServer({ config, services, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }
      const response = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`, {
        headers: {
          "x-athena-identity": "alice"
        }
      });
      expect(response.status).toBe(200);
      expect(observedAuthContext).toEqual({
        subject: "alice",
        role: "Admin",
        scope: {
          global: true,
          personas: [],
          sessionIds: [],
          runIds: []
        }
      });
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports configurable identity header names and wildcard mapping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_HEADER=x-athena-subject",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=svc-control:Admin,*:Operator"
      ].join("\n"),
      "utf8"
    );

    const config = loadConfig(dir);
    const server = createApiServer({ config, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }

      const missingCustomHeader = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`, {
        headers: {
          "x-athena-identity": "svc-control"
        }
      });
      expect(missingCustomHeader.status).toBe(401);

      const customHeaderResponse = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`, {
        headers: {
          "x-athena-subject": "unknown-principal"
        }
      });
      expect(customHeaderResponse.status).toBe(200);
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses optional scope headers and propagates scoped context", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-scope-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=scoped-op:Operator"
      ].join("\n"),
      "utf8"
    );
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    let observedAuthContext = getRequestAuthContext();
    const baseCapabilityService = services.capabilityService;
    services.capabilityService = {
      async getCapabilities() {
        observedAuthContext = getRequestAuthContext();
        return baseCapabilityService.getCapabilities();
      }
    };

    const server = createApiServer({ config, services, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }

      const response = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`, {
        headers: {
          "x-athena-identity": "scoped-op",
          "x-athena-scope-personas": "alpha,beta",
          "x-athena-scope-sessions": "s-1, s-2",
          "x-athena-scope-runs": "r-1"
        }
      });
      expect(response.status).toBe(200);
      expect(observedAuthContext).toEqual({
        subject: "scoped-op",
        role: "Operator",
        scope: {
          global: false,
          personas: ["alpha", "beta"],
          sessionIds: ["s-1", "s-2"],
          runIds: ["r-1"]
        }
      });
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 403 for denied role on protected operations", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-"));
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=viewer-user:Viewer"
      ].join("\n"),
      "utf8"
    );
    const config = loadConfig(dir);
    const server = createApiServer({ config, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }

      const response = await fetch(`http://${bound.host}:${bound.port}/api/v1/policy`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-athena-identity": "viewer-user"
        },
        body: JSON.stringify({
          schemaVersion: 1,
          maxConcurrentRuns: 2
        })
      });
      expect(response.status).toBe(403);
      const payload = (await response.json()) as {
        ok: boolean;
        error: { code: string; message: string; retryable: boolean };
      };
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe("AUTHZ_DENIED");
      expect(payload.error.message).toContain("policy.put");
      expect(payload.error.retryable).toBe(false);
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves persisted identity-role assignments before config identityRoleMap", async () => {
    const dir = mkdtempSync(join(tmpdir(), "athena-api-auth-persisted-"));
    mkdirSync(join(dir, ".athena", "rbac"), { recursive: true });
    writeFileSync(
      join(dir, ".env"),
      [
        "ATHENA_AUTH_ENABLED=true",
        "ATHENA_AUTHZ_MODE=enforce",
        "ATHENA_AUTH_IDENTITY_ROLE_MAP=alice:Viewer,*:Viewer"
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(dir, ".athena", "rbac", "assignments.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          assignments: [
            {
              subject: "alice",
              subjectType: "identity",
              role: "Admin",
              createdAt: "2026-02-20T00:00:00.000Z",
              updatedAt: "2026-02-20T00:00:00.000Z",
              updatedBy: "bootstrap-admin"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    const config = loadConfig(dir);
    const services = createLocalControlPlaneServices({ config });
    let observedAuthContext = getRequestAuthContext();
    const baseCapabilityService = services.capabilityService;
    services.capabilityService = {
      async getCapabilities() {
        observedAuthContext = getRequestAuthContext();
        return baseCapabilityService.getCapabilities();
      }
    };

    const server = createApiServer({ config, services, host: "127.0.0.1", port: 0 });
    let bound: { host: string; port: number } | undefined;
    let started = false;
    try {
      try {
        bound = await server.start();
        started = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("EPERM")) {
          return;
        }
        throw error;
      }
      if (!bound) {
        throw new Error("Server failed to bind");
      }
      const response = await fetch(`http://${bound.host}:${bound.port}/api/v1/capabilities`, {
        headers: {
          "x-athena-identity": "alice"
        }
      });
      expect(response.status).toBe(200);
      expect(observedAuthContext?.role).toBe("Admin");
      expect(observedAuthContext?.subject).toBe("alice");
    } finally {
      if (started) {
        await server.stop();
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
