import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FileDown, Loader2, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/features/resultados/components/PeriodFilter";
import { ReportView } from "@/features/resultados/components/ReportView";
import { isPreset, resolveRange, type PeriodSelection, type ReportData } from "@/features/resultados/lib/report-metrics";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-instagram-report";

type Payload = Omit<ReportData, "generatedAt"> & { period_days: number; generated_at: string };

// Client-facing Instagram report. Always light (reads and prints better than the internal dark UI);
// the internal theme is restored when the page unmounts. `?print=1` opens the browser's print dialog
// once the page has rendered, which is how "Baixar PDF" from the internal tab works.
export default function RelatorioPublic() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [selection, setSelection] = useState<PeriodSelection>({ kind: "preset", days: 30 });
  const range = useMemo(() => resolveRange(selection), [selection]);
  const originalTheme = useRef<"light" | "dark" | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (originalTheme.current === null) originalTheme.current = root.classList.contains("dark") ? "dark" : "light";
    const apply = () => {
      root.classList.remove("light", "dark");
      root.classList.add("light");
    };
    apply();
    // The global ThemeProvider re-applies its own class after mount; win that race on the next tick.
    const timer = setTimeout(apply, 0);
    return () => {
      clearTimeout(timer);
      root.classList.remove("light", "dark");
      root.classList.add(originalTheme.current ?? "light");
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        if (!res.ok) throw new Error("not_found");
        return (await res.json()) as Payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        if (isPreset(payload.period_days)) setSelection({ kind: "preset", days: payload.period_days });
        setState("ready");
      })
      .catch(() => !cancelled && setState("missing"));
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (state !== "ready" || printed.current) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    printed.current = true;
    // Give charts, fonts and thumbnails a moment to finish painting before the print snapshot.
    const timer = setTimeout(() => window.print(), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (state === "missing" || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="space-y-2">
          <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-lg font-semibold">Relatório indisponível</p>
          <p className="text-sm text-muted-foreground">Este link não existe mais ou foi desativado. Peça um novo link para a agência.</p>
        </div>
      </div>
    );
  }

  const report: ReportData = {
    client: data.client,
    snapshots: data.snapshots,
    media: data.media,
    audience: data.audience,
    generatedAt: data.generated_at,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <PeriodFilter value={selection} onChange={setSelection} />
          <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-full" onClick={() => window.print()}>
            <FileDown className="h-3.5 w-3.5" /> Baixar PDF
          </Button>
        </div>

        <ReportView data={report} range={range} mode="public" />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Dados fornecidos pelo Instagram. Relatório gerado em {new Date(data.generated_at).toLocaleDateString("pt-BR")}.
        </p>
      </div>
    </div>
  );
}
