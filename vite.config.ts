import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // ffmpeg.wasm loads its own JS/WASM core at runtime via `?url` imports (see
    // PmAttachmentsSection.tsx's loadFfmpeg) — Vite's esbuild-based dep scanner doesn't
    // understand that special-case and tries to naively pre-bundle @ffmpeg/core through
    // its package.json `main` field, which isn't a valid entry in its `exports` map,
    // crashing every dev-server request with "Missing ... specifier". Excluding these
    // from pre-bundling lets the dynamic imports resolve normally at request time instead.
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "@ffmpeg/core"],
  },
  define: {
    // Vercel sets this automatically during the build step (production/preview/development).
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? "development"),
  },
}));
