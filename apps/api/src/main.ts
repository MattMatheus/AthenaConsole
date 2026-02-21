import { createApiServer, loadConfig } from "@athena/core";

async function main() {
  const DEFAULT_API_HOST = "127.0.0.1";
  const DEFAULT_API_PORT = 8787;

  const apiHost = process.env.ATHENA_DEV_API_HOST ?? DEFAULT_API_HOST;
  const rawApiPort = process.env.ATHENA_DEV_API_PORT;
  const parsedApiPort = rawApiPort ? Number.parseInt(rawApiPort, 10) : DEFAULT_API_PORT;
  const apiPort = Number.isInteger(parsedApiPort) && parsedApiPort > 0 ? parsedApiPort : DEFAULT_API_PORT;

  const configRoot = process.env.ATHENA_WORKSPACE_ROOT ?? process.cwd();
  const config = loadConfig(configRoot);
  const server = createApiServer({ config, host: apiHost, port: apiPort });
  
  console.log(`Starting API server on ${apiHost}:${apiPort}...`);
  const bound = await server.start();
  console.log(`API server listening at http://${bound.host}:${bound.port}`);

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down API server...`);
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
