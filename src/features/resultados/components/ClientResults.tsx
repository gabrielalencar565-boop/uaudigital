import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Copy, ExternalLink, FileDown, FileText, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCompareSetting } from "../hooks/use-compare-setting";
import { PeriodFilter } from "./PeriodFilter";
import { ReportView } from "./ReportView";
import { resolveRange, type PeriodSelection, type PresetPeriod, type ReportData } from "../lib/report-metrics";
import {
  InsightsError, reportUrl, useAudience, useConnectWithInsights, useMediaInsights, useMetricSnapshots,
  useReportLink, useSaveReportLink, useSyncInsights,
} from "../hooks/use-resultados";

const DEFAULT_PERIOD: PresetPeriod = 30;

// The shared link only stores a preset (7/15/30/60/90); a custom range falls back to the default one.
function ShareReport({ clientId, selection }: { clientId: string; selection: PeriodSelection }) {
  const days: PresetPeriod = selection.kind === "preset" ? selection.days : DEFAULT_PERIOD;
  const linkQ = useReportLink(clientId);
  const save = useSaveReportLink();
  const link = linkQ.data;
  const url = link ? reportUrl(link.token) : "";

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  // Opened synchronously so the browser doesn't treat the tab as a blocked popup after the async save.
  const downloadPdf = async () => {
    if (link && !link.enabled) return;
    const tab = window.open("", "_blank");
    try {
      const current = link ?? (await save.mutateAsync({ clientId, periodDays: days }));
      if (tab) tab.location.href = reportUrl(current.token, true);
      else window.location.href = reportUrl(current.token, true);
    } catch {
      tab?.close();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-full">
          <FileText className="h-3.5 w-3.5" /> Relatório
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-4">
        <div>
          <p className="text-sm font-semibold">Relatório para o cliente</p>
          <p className="text-xs text-muted-foreground">Uma página com os gráficos e um resumo em linguagem simples, sem precisar de login.</p>
        </div>

        {!link ? (
          <div className="space-y-2">
            <Button className="w-full gap-1.5" disabled={save.isPending} onClick={() => save.mutate({ clientId, periodDays: days })}>
              <Link2 className="h-4 w-4" /> Criar link do relatório
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-full gap-1.5 text-xs text-muted-foreground" onClick={downloadPdf}>
              <FileDown className="h-3 w-3" /> Baixar PDF direto
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Label htmlFor="report-enabled">Link ativo</Label>
              <Switch
                id="report-enabled"
                checked={link.enabled}
                onCheckedChange={(enabled) => save.mutate({ clientId, periodDays: link.period_days, enabled })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="h-8 text-xs" />
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copy}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O cliente abre mostrando os últimos {link.period_days} dias e pode trocar o período.
              {selection.kind === "preset" && link.period_days !== days && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => save.mutate({ clientId, periodDays: days, enabled: link.enabled })}
                  >
                    Usar {days} dias
                  </button>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!link.enabled} onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!link.enabled} onClick={downloadPdf}>
                <FileDown className="h-3.5 w-3.5" /> Baixar PDF
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-0 text-xs text-muted-foreground"
              onClick={() => save.mutate({ clientId, periodDays: link.period_days, enabled: link.enabled, regenerate: true })}
            >
              <RefreshCw className="h-3 w-3" /> Gerar novo link (invalida o anterior)
            </Button>
          </>
        )}
        <p className="text-[11px] text-muted-foreground">No PDF, escolha “Salvar como PDF” na janela de impressão que abrir.</p>
      </PopoverContent>
    </Popover>
  );
}


// One client's Instagram results: period filter, report link/PDF, data refresh and the full report.
export function ClientResults({ clientId, clientName, logoUrl, username }: { clientId: string; clientName: string; logoUrl: string | null; username: string | null }) {
  const [needsReauth, setNeedsReauth] = useState(false);
  const [selection, setSelection] = useState<PeriodSelection>({ kind: "preset", days: DEFAULT_PERIOD });
  const range = useMemo(() => resolveRange(selection), [selection]);
  const [compare, setCompare] = useCompareSetting();
  useEffect(() => setNeedsReauth(false), [clientId]);

  const snapshotsQ = useMetricSnapshots(clientId);
  const mediaQ = useMediaInsights(clientId);
  const audienceQ = useAudience(clientId);
  const sync = useSyncInsights();
  const connect = useConnectWithInsights();

  const report: ReportData = useMemo(
    () => ({
      client: { name: clientName, logo_url: logoUrl, instagram_username: username },
      snapshots: snapshotsQ.data ?? [],
      media: mediaQ.data ?? [],
      audience: audienceQ.data ?? null,
      generatedAt: new Date().toISOString(),
    }),
    [clientName, logoUrl, username, snapshotsQ.data, mediaQ.data, audienceQ.data],
  );

  const runSync = () => {
    setNeedsReauth(false);
    sync.mutate({ clientId }, { onError: (e) => setNeedsReauth(e instanceof InsightsError && e.needsReauthorization) });
  };
  const reconnect = () => connect.mutate({ clientId }, { onSuccess: (url) => { window.location.href = url; } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PeriodFilter value={selection} onChange={setSelection} />
        <ShareReport clientId={clientId} selection={selection} />
        <label htmlFor="client-compare" className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border/60 px-3 text-xs text-muted-foreground">
          Comparar com o período anterior
          <Switch id="client-compare" checked={compare} onCheckedChange={setCompare} />
        </label>
        <Button size="sm" className="h-9 gap-1.5 rounded-full" disabled={sync.isPending} onClick={runSync}>
          <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Atualizar dados
        </Button>
      </div>

      {needsReauth && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 text-sm">
            A conta deste cliente ainda não deu permissão de métricas. Reconecte o Instagram dele uma vez para liberar os números.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 rounded-full" disabled={connect.isPending} onClick={reconnect}>
            Reconectar com métricas <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <ReportView data={report} range={range} mode="internal" compare={compare} />
    </div>
  );
}
