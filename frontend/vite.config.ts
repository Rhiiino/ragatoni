// rag-a-toni/frontend/vite.config.ts

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { keelPageVisits, readIndexTitle } from "./server/keelPageVisits";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      keelPageVisits({
        token: env.KEEL_INGEST_TOKEN,
        title: readIndexTitle(`${process.cwd()}/index.html`),
      }),
      react(),
    ],
    server: {
      port: 5188,
      host: "127.0.0.1",
      allowedHosts: ["rag-toni.themidhunraj.com"],
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8015",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      port: 5188,
      host: "127.0.0.1",
      allowedHosts: ["rag-toni.themidhunraj.com"],
    },
  };
});
