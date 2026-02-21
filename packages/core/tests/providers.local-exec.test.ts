import { describe, expect, it } from "vitest";
import { LocalExecProviderAdapter } from "../src/providers/local-exec.js";

describe("local-exec provider", () => {
  it("runs local executable and returns stdout", async () => {
    const provider = new LocalExecProviderAdapter({
      command: "/bin/echo",
      args: ["prefix"]
    });

    const result = await provider.generate({
      sessionId: "s1",
      input: "hello"
    });

    expect(result.provider).toBe("local-exec");
    expect(result.output).toBe("prefix hello");
  });
});
