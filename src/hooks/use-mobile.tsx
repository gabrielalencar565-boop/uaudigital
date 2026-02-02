import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // iOS/Safari antigos: MediaQueryList não tem addEventListener/removeEventListener
    // (usa addListener/removeListener). Sem esse fallback, alguns aparelhos quebram e ficam “tela branca”.
    const hasEventListenerApi = typeof (mql as any).addEventListener === "function";
    if (hasEventListenerApi) {
      (mql as any).addEventListener("change", onChange);
    } else if (typeof (mql as any).addListener === "function") {
      (mql as any).addListener(onChange);
    }

    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      if (hasEventListenerApi && typeof (mql as any).removeEventListener === "function") {
        (mql as any).removeEventListener("change", onChange);
      } else if (typeof (mql as any).removeListener === "function") {
        (mql as any).removeListener(onChange);
      }
    };
  }, []);

  return !!isMobile;
}
