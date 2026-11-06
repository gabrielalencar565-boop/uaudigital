import type { NextConfig } from "next";

/**
 * O Raio-X mora em www.uaucomunicacaodigital.com.br/raiox.
 * A landing (site-uau) repassa /raiox para este projeto (rewrite no vercel.json dela).
 */
const basePath = "/raiox";

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  poweredByHeader: false,
  turbopack: {
    // O repositório pai também tem package.json: fixa a raiz neste app.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
