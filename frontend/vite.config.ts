import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    // The backend serves the built interface from this folder.
    outDir: "../backend/app/static",
    emptyOutDir: true,
  },
  server: {
    // During development (`npm run dev`), API calls go to the Python server.
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
