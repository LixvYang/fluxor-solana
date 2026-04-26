import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: fileURLToPath(
        new URL("./node_modules/buffer/index.js", import.meta.url)
      ),
    },
  },
  server: {
    port: 5173,
  },
});
