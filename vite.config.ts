import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const PROJECT_ROOT = import.meta.dirname;
const CLIENT_ROOT = path.resolve(PROJECT_ROOT, "client");
const IS_VERCEL = process.env.VERCEL === "1";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(CLIENT_ROOT, "src"),
      "@shared": path.resolve(PROJECT_ROOT, "shared"),
    },
  },
  envDir: PROJECT_ROOT,
  root: CLIENT_ROOT,
  publicDir: path.resolve(CLIENT_ROOT, "public"),
  build: {
    // O framework Express da Vercel publica automaticamente arquivos em /public.
    // Fora da Vercel preservamos o build Node tradicional em dist/public.
    outDir: IS_VERCEL
      ? path.resolve(PROJECT_ROOT, "public")
      : path.resolve(PROJECT_ROOT, "dist", "public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
