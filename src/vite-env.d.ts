/// <reference types="vite/client" />

/** Baked in at build time from Vercel's VERCEL_ENV system variable — see vite.config.ts. */
declare const __VERCEL_ENV__: "production" | "preview" | "development";

/** Handle returned by FluxoLoader.show(), opened inline in index.html before React mounts. */
interface FluxoLoaderHandle {
  element: HTMLDivElement;
  hide: () => Promise<void>;
  destroy: () => Promise<void>;
}

interface Window {
  __fluxoLoader?: FluxoLoaderHandle | null;
}
