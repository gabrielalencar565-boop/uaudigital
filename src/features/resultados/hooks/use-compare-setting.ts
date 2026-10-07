import { useState } from "react";

const KEY = "fluxo-report-compare";

/** "Comparar com o período anterior" switch, remembered on this browser (on by default). */
export function useCompareSetting() {
  const [compare, setCompare] = useState(() => {
    try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
  });
  const update = (on: boolean) => {
    setCompare(on);
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* preference only */ }
  };
  return [compare, update] as const;
}
