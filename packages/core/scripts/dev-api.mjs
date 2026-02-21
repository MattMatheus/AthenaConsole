import { spawn } from "node:child_process";

const DEFAULT_API_HOST = "127.0.0.1";
const DEFAULT_API_PORT = 8787;

const apiHost = process.env.ATHENA_DEV_API_HOST ?? DEFAULT_API_HOST;
const rawApiPort = process.env.ATHENA_DEV_API_PORT;
const parsedApiPort = rawApiPort ? Number.parseInt(rawApiPort, 10) : DEFAULT_API_PORT;
const apiPort = Number.isInteger(parsedApiPort) && parsedApiPort > 0 ? parsedApiPort : DEFAULT_API_PORT;

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["exec", "tsx", "watch", "src/cli/main.ts", "--", "api", "serve", "--host", apiHost, "--port", String(apiPort)],
  {
    stdio: "inherit",
    env: process.env
  }
);

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  child.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
