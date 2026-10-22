import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo local (fuera de Docker) proxyamos al backend en :8000.
// En Docker, nginx hace el proxy, así que el frontend usa rutas relativas.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
