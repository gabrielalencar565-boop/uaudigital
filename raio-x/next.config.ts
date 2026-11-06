import type { NextConfig } from "next";

/**
 * O Raio-X mora em www.uaucomunicacaodigital.com.br/raioxsocialmedia.
 * A landing (site-uau) repassa /raioxsocialmedia para este projeto (rewrite no vercel.json dela).
 */
const basePath = "/raioxsocialmedia";

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
