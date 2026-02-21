import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
function parsePort(value, fallback) {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiHost = env.ATHENA_DEV_API_HOST ?? "127.0.0.1";
    const apiPort = parsePort(env.ATHENA_DEV_API_PORT, 8787);
    const uiPort = parsePort(env.ATHENA_DEV_UI_PORT, 5173);
    const proxyTarget = env.ATHENA_DEV_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? `http://${apiHost}:${apiPort}`;
    return {
        plugins: [react()],
        server: {
            host: env.ATHENA_DEV_UI_HOST ?? "127.0.0.1",
            port: uiPort,
            proxy: {
                "/api": {
                    target: proxyTarget,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
        build: {
            minify: "esbuild",
            cssMinify: true,
            sourcemap: true,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ["react", "react-dom", "@tanstack/react-query"],
                    },
                },
            },
        },
    };
});
