"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Logo da UAU. Usa /public/logo-uau.png se existir; se não existir
 * (ou falhar ao carregar), mostra o texto "uaudigital" em peso 800.
 */
export default function Logo({ className = "", textClassName = "text-white" }: { className?: string; textClassName?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // A imagem pode falhar antes do React hidratar (onError não dispara).
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span className={`text-2xl font-extrabold tracking-[-0.03em] ${textClassName} ${className}`}>uaudigital</span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src="/logo-uau.png" alt="UAU Digital" className={`h-8 w-auto ${className}`} onError={() => setFailed(true)} />
  );
}
