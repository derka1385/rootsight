import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // API_URL lets a second checkout run against its own server (e.g. API_URL=http://localhost:8788).
  server: { proxy: { "/api": process.env.API_URL ?? "http://localhost:8787" } },
});
