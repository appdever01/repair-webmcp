import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: "dist/bundle-report.html", gzipSize: true, template: "treemap" }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    manifest: true,
    chunkSizeWarningLimit: 1200,
  },
});
