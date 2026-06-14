import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SecretResolver } from "../src/control-plane/services/secret-resolver.js";
import { loadConfig } from "../src/shared/config.js";
import type { EventEmitRequest, EventQueryResult } from "../src/shared/contracts.js";

const ENV_KEY = "ATHENA_TEST_SECRET_RESOLVER_KEY";

describe("SecretResolver", () => {
  let workspaceRoot: string;
  let previousEnvValue: string | undefined;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "athena-secret-resolver-"));
    previousEnvValue = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (previousEnvValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = previousEnvValue;
    }
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it("resolves env secrets from process.env", () => {
    process.env[ENV_KEY] = "bar";

    const resolver = createResolver();

    expect(resolver.resolve({ kind: "env", name: ENV_KEY })).toBe("bar");
  });

  it("falls back to a workspace .env value when process.env is missing", () => {
    writeFileSync(join(workspaceRoot, ".env"), `${ENV_KEY}=bar\n`, "utf8");

    const resolver = createResolver();

    expect(resolver.resolve({ kind: "env", name: ENV_KEY })).toBe("bar");
  });

  it("parses quoted .env values while preserving equals signs after the first separator", () => {
    writeFileSync(join(workspaceRoot, ".env"), `# ${ENV_KEY}=ignored\n${ENV_KEY}="ba=r"\n`, "utf8");

    const resolver = createResolver();

    expect(resolver.resolve({ kind: "env", name: ENV_KEY })).toBe("ba=r");
  });

  it("throws CONFIG_ERROR when an env secret is not configured", () => {
    const resolver = createResolver();

    expect(() => resolver.resolve({ kind: "env", name: ENV_KEY })).toThrow(
      `Environment secret is not configured: ${ENV_KEY}`
    );
  });

  it("requires local-file secrets to use absolute paths", () => {
    const resolver = createResolver();

    expect(() => resolver.resolve({ kind: "local-file", name: "relative-secret.txt" })).toThrow(
      "Local-file secret reference must be an absolute path."
    );
  });

  it("requires local-file secrets to exist", () => {
    const resolver = createResolver();

    expect(() => resolver.resolve({ kind: "local-file", name: join(workspaceRoot, "missing.key") })).toThrow(
      "Local-file secret reference does not exist."
    );
  });

  it("requires local-file secrets to contain a non-empty value", () => {
    const secretFile = join(workspaceRoot, "empty.key");
    writeFileSync(secretFile, "  \n\t", "utf8");
    const resolver = createResolver();

    expect(() => resolver.resolve({ kind: "local-file", name: secretFile })).toThrow(
      "Local-file secret reference is empty."
    );
  });

  it("trims local-file secret values", () => {
    const secretFile = join(workspaceRoot, "provider.key");
    writeFileSync(secretFile, "  secret\n", "utf8");
    const resolver = createResolver();

    expect(resolver.resolve({ kind: "local-file", name: secretFile })).toBe("secret");
  });

  it("audits secret reads without including resolved secret values", async () => {
    process.env[ENV_KEY] = "sk-resolved-secret";
    const events: EventEmitRequest[] = [];
    const resolver = createResolver(events);

    const value = resolver.resolve(
      { kind: "env", name: ENV_KEY },
      { purpose: "test.secret-read", subject: "operator", resourceId: "provider-1" }
    );
    await Promise.resolve();

    expect(value).toBe("sk-resolved-secret");
    expect(events).toEqual([
      {
        type: "secret.read",
        payload: {
          reference: {
            kind: "env",
            name: ENV_KEY
          },
          purpose: "test.secret-read",
          subject: "operator",
          resourceId: "provider-1"
        }
      }
    ]);
    expect(JSON.stringify(events)).not.toContain("sk-resolved-secret");
  });

  function createResolver(events?: EventEmitRequest[]): SecretResolver {
    return new SecretResolver(loadConfig(workspaceRoot), {
      ...(events
        ? {
            eventService: {
              async emit(event: EventEmitRequest) {
                events.push(event);
              },
              async list(): Promise<EventQueryResult> {
                return { events: [] };
              }
            }
          }
        : {})
    });
  }
});
