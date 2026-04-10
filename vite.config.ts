import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { compression } from "vite-plugin-compression2";

// SaaS VALA — Production Build Config (v4)
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },

    plugins: [
      react(),
      ...(isDev ? [componentTagger()] : []),
      compression({ algorithm: "gzip", exclude: [/\.map$/], threshold: 10 * 1024 }),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "favicon.ico", "softwarevala-logo.png"],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
          globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}"],
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/[^/]+\/functions\/v1\/api-gateway\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-gateway-cache",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "google-fonts-cache",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "unsplash-images",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        manifest: {
          name: "SaaS VALA - Software Marketplace",
          short_name: "SaaS VALA",
          description: "AI-powered software marketplace with 2000+ products. Install for offline access.",
          theme_color: "#f97316",
          background_color: "#0a0a0a",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          icons: [
            { src: "/favicon.png", sizes: "192x192", type: "image/png" },
            { src: "/favicon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
      }),
    ],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"],
    },

    build: {
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      minify: "esbuild",
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("date-fns")) return "vendor-date";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("framer-motion")) return "vendor-motion";
          },
        },
      },
    },
  };
});
