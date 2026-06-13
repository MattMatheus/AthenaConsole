import { spawn } from "node:child_process";
import { resolve } from "node:path";

const stdin = await readStdin();
const runner = resolveRunner();
const child = spawn(runner.command, runner.args, {
  cwd: runner.cwd,
  env: runner.env,
  stdio: ["pipe", "pipe", "pipe"]
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.stdin.end(stdin);

child.on("error", (error) => {
  process.stderr.write(`Failed to start AthenaAgent console runner: ${error.message}\n`);
  process.exitCode = 1;
});

const exit = await waitForExit(child);
if (exit.signal) {
  process.stderr.write(`AthenaAgent console runner stopped by signal ${exit.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = exit.code ?? 1;
}

function resolveRunner() {
  const override = process.env.ATHENA_AGENT_CONSOLE_RUNNER;
  if (override) {
    const command = parseRunnerOverride(override);
    return {
      command: command[0],
      args: command.slice(1),
      cwd: process.cwd(),
      env: process.env
    };
  }

  const athenaAgentRoot = process.env.ATHENA_AGENT_REPO ?? resolve(process.cwd(), "../../../AthenaAgent");
  const python = process.env.ATHENA_AGENT_PYTHON ?? "python3";
  return {
    command: python,
    args: ["-m", "athena_agent.console_runner"],
    cwd: athenaAgentRoot,
    env: {
      ...process.env,
      PYTHONPATH: [athenaAgentRoot, process.env.PYTHONPATH].filter(Boolean).join(":")
    }
  };
}

function parseRunnerOverride(value) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((part) => typeof part === "string") && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fall back to treating the override as an executable path.
  }
  return [value];
}

function readStdin() {
  return new Promise((resolveRead, rejectRead) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolveRead(raw));
    process.stdin.on("error", rejectRead);
  });
}

function waitForExit(childProcess) {
  return new Promise((resolveExit) => {
    childProcess.on("exit", (code, signal) => resolveExit({ code, signal }));
  });
}
