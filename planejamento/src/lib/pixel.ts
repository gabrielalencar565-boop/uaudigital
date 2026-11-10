type Fbq = (action: "track", event: string, params?: Record<string, unknown>) => void;

/** Dispara um evento padrão do Pixel da Meta, se o pixel estiver carregado. */
export function trackPixel(event: "Lead" | "CompleteRegistration", params?: Record<string, unknown>) {
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (typeof fbq === "function") fbq("track", event, params);
  } catch {
    // pixel é opcional: nunca quebra o fluxo
  }
}
