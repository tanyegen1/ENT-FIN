import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Standalone single-file bundle used only for publishing a preview
// (e.g. as a Claude Artifact). The normal `vite build` output (code-split,
// external favicon, etc.) is what you'd actually deploy.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
  },
});
