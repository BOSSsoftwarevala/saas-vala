// vite.config.ts
import { defineConfig } from "file:///C:/Users/dell/Desktop/saas/saas-vala-1/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/dell/Desktop/saas/saas-vala-1/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "node:path";
import { componentTagger } from "file:///C:/Users/dell/Desktop/saas/saas-vala-1/node_modules/lovable-tagger/dist/index.js";
import { compression } from "file:///C:/Users/dell/Desktop/saas/saas-vala-1/node_modules/vite-plugin-compression2/dist/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\dell\\Desktop\\saas\\saas-vala-1";
var vite_config_default = defineConfig(({ mode }) => {
  const isDev = mode === "development";
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false
      }
    },
    plugins: [
      react(),
      ...isDev ? [componentTagger()] : [],
      compression({ algorithm: "gzip", exclude: [/\.map$/], threshold: 10 * 1024 })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"]
    },
    build: {
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      minify: "esbuild",
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1e3,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack") || id.includes("react-query")) return "vendor-query";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("date-fns")) return "vendor-date";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("@elevenlabs")) return "vendor-audio";
            if (id.includes("@hookform") || id.includes("react-hook-form")) return "vendor-forms";
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxkZWxsXFxcXERlc2t0b3BcXFxcc2Fhc1xcXFxzYWFzLXZhbGEtMVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZGVsbFxcXFxEZXNrdG9wXFxcXHNhYXNcXFxcc2Fhcy12YWxhLTFcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2RlbGwvRGVza3RvcC9zYWFzL3NhYXMtdmFsYS0xL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuaW1wb3J0IHsgY29tcHJlc3Npb24gfSBmcm9tIFwidml0ZS1wbHVnaW4tY29tcHJlc3Npb24yXCI7XHJcblxyXG4vLyBTYWFTIFZBTEEgXHUyMDE0IFByb2R1Y3Rpb24gQnVpbGQgQ29uZmlnICh2NClcclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGlzRGV2ID0gbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IFwiOjpcIixcclxuICAgICAgcG9ydDogODA4MCxcclxuICAgICAgaG1yOiB7XHJcbiAgICAgICAgb3ZlcmxheTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG5cclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgcmVhY3QoKSxcclxuICAgICAgLi4uKGlzRGV2ID8gW2NvbXBvbmVudFRhZ2dlcigpXSA6IFtdKSxcclxuICAgICAgY29tcHJlc3Npb24oeyBhbGdvcml0aG06IFwiZ3ppcFwiLCBleGNsdWRlOiBbL1xcLm1hcCQvXSwgdGhyZXNob2xkOiAxMCAqIDEwMjQgfSksXHJcbiAgICBdLFxyXG5cclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgICAgfSxcclxuICAgICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCJdLFxyXG4gICAgfSxcclxuXHJcbiAgICBidWlsZDoge1xyXG4gICAgICB0YXJnZXQ6IFwiZXMyMDIwXCIsXHJcbiAgICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcclxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgICAgbWluaWZ5OiBcImVzYnVpbGRcIixcclxuICAgICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IHRydWUsXHJcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XHJcbiAgICAgICAgICAgIGlmICghaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIC8vIENvcmUgUmVhY3RcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3RcIikgfHwgaWQuaW5jbHVkZXMoXCJyZWFjdC1kb21cIikpIHJldHVybiBcInZlbmRvci1yZWFjdFwiO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUm91dGVyXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlYWN0LXJvdXRlclwiKSkgcmV0dXJuIFwidmVuZG9yLXJvdXRlclwiO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gU3VwYWJhc2VcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHN1cGFiYXNlXCIpKSByZXR1cm4gXCJ2ZW5kb3Itc3VwYWJhc2VcIjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFF1ZXJ5L1N0YXRlIE1hbmFnZW1lbnRcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiQHRhbnN0YWNrXCIpIHx8IGlkLmluY2x1ZGVzKFwicmVhY3QtcXVlcnlcIikpIHJldHVybiBcInZlbmRvci1xdWVyeVwiO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQ2hhcnRzXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInJlY2hhcnRzXCIpIHx8IGlkLmluY2x1ZGVzKFwiZDMtXCIpKSByZXR1cm4gXCJ2ZW5kb3ItY2hhcnRzXCI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBVSSBDb21wb25lbnRzXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkByYWRpeC11aVwiKSkgcmV0dXJuIFwidmVuZG9yLXVpXCI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBVdGlsaXRpZXNcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiZGF0ZS1mbnNcIikpIHJldHVybiBcInZlbmRvci1kYXRlXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImx1Y2lkZS1yZWFjdFwiKSkgcmV0dXJuIFwidmVuZG9yLWljb25zXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImZyYW1lci1tb3Rpb25cIikpIHJldHVybiBcInZlbmRvci1tb3Rpb25cIjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEF1ZGlvL1ZpZGVvXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkBlbGV2ZW5sYWJzXCIpKSByZXR1cm4gXCJ2ZW5kb3ItYXVkaW9cIjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEZvcm1zXHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIkBob29rZm9ybVwiKSB8fCBpZC5pbmNsdWRlcyhcInJlYWN0LWhvb2stZm9ybVwiKSkgcmV0dXJuIFwidmVuZG9yLWZvcm1zXCI7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdULFNBQVMsb0JBQW9CO0FBQzdVLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFKNUIsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxRQUFRLFNBQVM7QUFFdkIsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sS0FBSztBQUFBLFFBQ0gsU0FBUztBQUFBLE1BQ1g7QUFBQSxJQUNGO0FBQUEsSUFFQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixHQUFJLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7QUFBQSxNQUNuQyxZQUFZLEVBQUUsV0FBVyxRQUFRLFNBQVMsQ0FBQyxRQUFRLEdBQUcsV0FBVyxLQUFLLEtBQUssQ0FBQztBQUFBLElBQzlFO0FBQUEsSUFFQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDdEM7QUFBQSxNQUNBLFFBQVEsQ0FBQyxTQUFTLGFBQWEsbUJBQW1CO0FBQUEsSUFDcEQ7QUFBQSxJQUVBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFdBQVc7QUFBQSxNQUNYLFFBQVE7QUFBQSxNQUNSLHNCQUFzQjtBQUFBLE1BQ3RCLHVCQUF1QjtBQUFBLE1BQ3ZCLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGFBQWEsSUFBSTtBQUNmLGdCQUFJLENBQUMsR0FBRyxTQUFTLGNBQWMsRUFBRztBQUdsQyxnQkFBSSxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUc3RCxnQkFBSSxHQUFHLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFHeEMsZ0JBQUksR0FBRyxTQUFTLFdBQVcsRUFBRyxRQUFPO0FBR3JDLGdCQUFJLEdBQUcsU0FBUyxXQUFXLEtBQUssR0FBRyxTQUFTLGFBQWEsRUFBRyxRQUFPO0FBR25FLGdCQUFJLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLEtBQUssRUFBRyxRQUFPO0FBRzFELGdCQUFJLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUdyQyxnQkFBSSxHQUFHLFNBQVMsVUFBVSxFQUFHLFFBQU87QUFDcEMsZ0JBQUksR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBQ3hDLGdCQUFJLEdBQUcsU0FBUyxlQUFlLEVBQUcsUUFBTztBQUd6QyxnQkFBSSxHQUFHLFNBQVMsYUFBYSxFQUFHLFFBQU87QUFHdkMsZ0JBQUksR0FBRyxTQUFTLFdBQVcsS0FBSyxHQUFHLFNBQVMsaUJBQWlCLEVBQUcsUUFBTztBQUFBLFVBQ3pFO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
