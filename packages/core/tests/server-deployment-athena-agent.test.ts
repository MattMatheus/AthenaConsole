import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

describe("server deployment AthenaAgent runtime packaging", () => {
  it("builds the API image with the sibling AthenaAgent source as an explicit context", () => {
    const compose = yaml.load(readRepoFile("docker-compose.server.yml")) as {
      services?: {
        api?: {
          build?: {
            additional_contexts?: Record<string, string>;
          };
          environment?: Record<string, string>;
        };
      };
    };

    const api = compose.services?.api;
    expect(api?.build?.additional_contexts).toMatchObject({
      athena_agent: "../AthenaAgent"
    });
    expect(api?.environment).toMatchObject({
      ATHENA_AGENT_REPO: "/opt/athena-agent-src",
      ATHENA_AGENT_PYTHON: "/opt/athena-agent-venv/bin/python"
    });
  });

  it("installs AthenaAgent into a Python 3.11+ venv in the production API runtime image", () => {
    const dockerfile = readRepoFile("packages/core/infrastructure/docker/control-plane.prod.Dockerfile");

    expect(dockerfile).toContain("python3");
    expect(dockerfile).toContain("python3-venv");
    expect(dockerfile).toContain("COPY --from=athena_agent . /opt/athena-agent-src");
    expect(dockerfile).toContain("python3 -m venv /opt/athena-agent-venv");
    expect(dockerfile).toContain("/opt/athena-agent-venv/bin/python -m pip install --no-cache-dir /opt/athena-agent-src");
    expect(dockerfile).toContain("ENV ATHENA_AGENT_REPO=/opt/athena-agent-src");
    expect(dockerfile).toContain("ENV ATHENA_AGENT_PYTHON=/opt/athena-agent-venv/bin/python");
  });

  it("documents the repeatable AthenaAgent runtime smoke and durable restart checks", () => {
    const guide = readRepoFile("docs/developer/product-dev-guides/local-server-deployment.md");

    expect(guide).toContain("AthenaAgent Runtime");
    expect(guide).toContain("docker compose --env-file server.env -f docker-compose.server.yml exec api");
    expect(guide).toContain("import athena_agent.console_runner");
    expect(guide).toContain("restart the stack");
    expect(guide).toContain("/api/v1/task-runs/");
  });
});

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}
