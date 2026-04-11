import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { componentTagger } from "lovable-tagger";
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
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            // Core React
            if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
            
            // Router
            if (id.includes("react-router")) return "vendor-router";
            
            // Supabase
            if (id.includes("@supabase")) return "vendor-supabase";
            
            // Query/State Management
            if (id.includes("@tanstack") || id.includes("react-query")) return "vendor-query";
            
            // Charts
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            
            // UI Components
            if (id.includes("@radix-ui")) return "vendor-ui";
            
            // Utilities
            if (id.includes("date-fns")) return "vendor-date";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("framer-motion")) return "vendor-motion";
            
            // Audio/Video
            if (id.includes("@elevenlabs")) return "vendor-audio";
            
            // Forms
            if (id.includes("@hookform") || id.includes("react-hook-form")) return "vendor-forms";
          },
        },
      },
    },
  };
});
