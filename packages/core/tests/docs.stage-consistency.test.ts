import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function extractStageNumber(text: string): number | undefined {
  const match = text.match(/Stage\s+(\d+)/i);
  if (!match?.[1]) {
    return undefined;
  }
  return Number.parseInt(match[1], 10);
}

describe("docs stage consistency", () => {
  it("keeps AGENTS.md, docs/README.md, docs/getting-started/README.md, and IMPLEMENT.MD on the same stage", () => {
    const root = process.cwd();
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const readme = readFileSync(resolve(root, "docs", "README.md"), "utf8");
    const gettingStarted = readFileSync(resolve(root, "docs", "getting-started", "README.md"), "utf8");
    const implement = readFileSync(resolve(root, "IMPLEMENT.MD"), "utf8");

    const agentsStage = extractStageNumber(agents);
    const readmeStage = extractStageNumber(readme);
    const gettingStartedStage = extractStageNumber(gettingStarted);
    const implementMatch = implement.match(/Completed:\s*Stage\s*0\s*through\s*Stage\s*(\d+)/i);
    const implementStage = implementMatch?.[1] ? Number.parseInt(implementMatch[1], 10) : undefined;

    expect(agentsStage).toBeDefined();
    expect(readmeStage).toBeDefined();
    expect(gettingStartedStage).toBeDefined();
    expect(implementStage).toBeDefined();

    expect(readmeStage).toBe(agentsStage);
    expect(gettingStartedStage).toBe(agentsStage);
    expect(implementStage).toBe(agentsStage);
  });
});
