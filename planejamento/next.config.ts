import type { NextConfig } from "next";

/**
 * O app mora em www.uaucomunicacaodigital.com.br/planejamento.
 * A landing (site-uau) repassa /planejamento para este projeto (rewrite no vercel.json dela).
 */
const basePath = "/planejamento";

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  poweredByHeader: false,
  // O react-pdf roda melhor fora do bundle do servidor.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fontes do PDF precisam ir junto com a função na Vercel.
  outputFileTracingIncludes: { "/api/pdf": ["./src/assets/**/*"] },
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
