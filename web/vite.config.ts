import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // API_PORT lets a second checkout run its own API next to another one.
  server: { proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 8787}` } },
});
