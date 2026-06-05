import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "משימות",
        short_name: "משימות",
        description: "לוח משימות — Kanban",
        dir: "rtl",
        lang: "he",
        scope: "/",
        start_url: "/",
        display: "standalone",
        background_color: "#16182a",
        theme_color: "#16182a",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Don't intercept navigation to /uploads/ — those are real files served by
        // nginx. Without this, the service worker serves index.html for image URLs,
        // which is why clicking uploaded images did nothing.
        navigateFallbackDenylist: [/^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "task-uploads",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        ws: true,
      },
    },
  },
});
