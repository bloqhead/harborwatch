import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { createHtmlPlugin } from "vite-plugin-html";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      vue(),
      createHtmlPlugin({
        inject: {
          data: {
            VITE_UMAMI_SITE_ID: env.VITE_UMAMI_SITE_ID ?? "",
            VITE_UMAMI_URL: env.VITE_UMAMI_URL ?? "https://harborwatch-analytics.onrender.com",
          },
        },
      }),
    ],
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:8000",
      },
    },
  };
});
