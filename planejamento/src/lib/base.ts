/** Prefixo do app (/planejamento). fetch, <img> e <a> comuns precisam dele; next/link não. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const withBase = (path: string) => `${BASE_PATH}${path}`;
