import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    allowedHosts: ["omnivoice.awaqai.com"],
    proxy: {
      "/v1": {
        target: "http://localhost:8005",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "http://localhost:8005",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
