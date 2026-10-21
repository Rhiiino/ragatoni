// rag-a-toni/frontend/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    host: "127.0.0.1",
    allowedHosts: ["ragatoni.themidhunraj.com", "rag-toni.themidhunraj.com"],
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
    allowedHosts: ["ragatoni.themidhunraj.com", "rag-toni.themidhunraj.com"],
  },
});
