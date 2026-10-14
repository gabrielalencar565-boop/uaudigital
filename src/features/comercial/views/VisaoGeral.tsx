import { useMemo, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { attentionGroups, brl, computeOverview, diffDays, SOURCES, waLink } from "../lib/rules";
import { BarRow, Empty, Kpi, PageHead, Panel } from "../components/ui-bits";

const SEVERITY: Record<string, string> = {
  late: "border-red-500/30 bg-red-500/5",
  today: "border-amber-500/30 bg-amber-500/5",
  info: "border-border/50 bg-muted/20",
};
const COUNT_TONE: Record<string, string> = {
  late: "bg-red-500 text-white",
  today: "bg-amber-500 text-white",
  info: "bg-muted text-muted-foreground",
};

export function VisaoGeral() {
  const { leads, stages, acts, clients, clientTasks, team, contacted, today, stageOf, memberOf, leadOf, openLead, openClient, newActivity } = useComercial();
  const [period, setPeriod] = useState("30");

  const o = useMemo(() => computeOverview(leads, stages, acts, clients, Number(period), today), [leads, stages, acts, clients, period, today]);
  const attention = useMemo(() => attentionGroups(leads, stages, acts, clients, clientTasks, contacted, today), [leads, stages, acts, clients, clientTasks, contacted, today]);

  const openStages = stages.filter((s) => s.type === "open").sort((a, b) => a.position - b.position);
  const maxCount = Math.max(1, ...openStages.map((s) => o.open.filter((l) => l.stage_id === s.id).length));
  const bySource = SOURCES.map((s) => ({
    s, n: o.created.filter((l) => l.source === s).length, w: o.won.filter((l) => l.source === s).length,
  })).filter((x) => x.n || x.w);
  const maxSource = Math.max(1, ...bySource.map((x) => x.n));
  const byOwner = team
    .map((t) => ({
      t,
      open: o.open.filter((l) => l.owner_id === t.user_id),
      won: o.won.filter((l) => l.owner_id === t.user_id),
      late: acts.filter((a) => a.owner_id === t.user_id && !a.done && diffDays(a.due_date, today) < 0).length,
    }))
    .filter((x) => x.open.length || x.won.length || x.late);

  return (
    <div className="space-y-4">
      <PageHead
        title="Visão geral"
        right={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="0">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Leads novos" value={o.created.length} sub={`${o.open.length} oportunidades abertas`} />
        <Kpi label="Em negociação" value={<>{brl(o.pipeline)}<span className="text-xs font-normal text-muted-foreground">/mês</span></>} sub={`Previsão ponderada: ${brl(o.forecast)}`} />
        <Kpi label="Vendido no período" value={<>{brl(o.sold)}<span className="text-xs font-normal text-muted-foreground">/mês</span></>} sub={`${o.won.length} ganho${o.won.length !== 1 ? "s" : ""} · ${o.lost.length} perdido${o.lost.length !== 1 ? "s" : ""}`} />
        <Kpi label="Conversão" value={o.conversion === null ? "—" : `${o.conversion}%`} sub={o.cycleDays === null ? "Sem vendas no período" : `Ciclo médio de ${o.cycleDays} dias`} />
        <Kpi label="Reuniões" value={o.meetingsDone} sub={`${o.meetingsScheduled} agendada${o.meetingsScheduled !== 1 ? "s" : ""}`} />
        <Kpi label="Ticket médio" value={o.ticket === null ? "—" : brl(o.ticket)} sub="Valor mensal dos ganhos" />
        <Kpi label="Receita recorrente (MRR)" value={brl(o.mrr)} sub={`${clients.length} cliente${clients.length !== 1 ? "s" : ""} vindo${clients.length !== 1 ? "s" : ""} do CRM`} />
        <Kpi label="Follow-ups atrasados" value={o.lateActivities} sub="Atividades vencidas" tone={o.lateActivities ? "late" : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="O que fazer agora">
          {attention.length === 0 ? (
            <Empty>Tudo em dia. Nenhuma pendência agora.</Empty>
          ) : (
            <div className="space-y-3">
              {attention.map((g) => (
                <div key={g.key} className={cn("rounded-xl border", SEVERITY[g.severity])}>
                  <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2 text-xs font-medium">
                    <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums", COUNT_TONE[g.severity])}>{g.items.length}</span>
                    {g.title}
                  </div>
                  <ul className="divide-y divide-border/30">
                    {g.items.map((it, i) => {
                      const l = leadOf(it.leadId);
                      if (!l) return null;
                      const wa = waLink(l.phone);
                      return (
                        <li key={`${it.leadId}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="min-w-0 text-sm">
                            <button type="button" onClick={() => (it.clientId ? openClient(it.clientId) : openLead(l.id))} className="font-medium hover:underline">
                              {l.name}
                            </button>
                            <span className="text-xs text-muted-foreground"> · {it.sub}</span>
                          </span>
                          {it.action === "whats" && wa ? (
                            <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs">
                              <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3 w-3" /> WhatsApp</a>
                            </Button>
                          ) : it.action === "task" ? (
                            <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => newActivity(l.id)}>
                              <Plus className="h-3 w-3" /> Próxima ação
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Funil agora">
            <div className="space-y-2">
              {openStages.map((s) => {
                const L = o.open.filter((l) => l.stage_id === s.id);
                const v = L.reduce((a, l) => a + l.value, 0);
                return <BarRow key={s.id} label={s.name} value={L.length} max={maxCount} text={`${L.length} · ${brl(v)}`} title={`${s.name}: ${L.length} negócios, ${brl(v)}/mês`} />;
              })}
            </div>
          </Panel>

          <Panel title="Origem dos leads no período">
            {bySource.length === 0 ? (
              <Empty>Nenhum lead no período</Empty>
            ) : (
              <div className="space-y-2">
                {bySource.map((x) => (
                  <BarRow key={x.s} label={x.s} value={x.n} max={maxSource} text={`${x.n} lead${x.n !== 1 ? "s" : ""} · ${x.w} venda${x.w !== 1 ? "s" : ""}`} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Por responsável">
            {byOwner.length === 0 ? (
              <Empty>Ninguém com negócios ainda</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">Pessoa</th>
                      <th className="pb-2 text-right font-medium">Abertos</th>
                      <th className="pb-2 text-right font-medium">Em negociação</th>
                      <th className="pb-2 text-right font-medium">Ganhos</th>
                      <th className="pb-2 text-right font-medium">Atrasados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {byOwner.map((x) => (
                      <tr key={x.t.user_id}>
                        <td className="py-1.5">{memberOf(x.t.user_id)?.display_name}</td>
                        <td className="py-1.5 text-right tabular-nums">{x.open.length}</td>
                        <td className="py-1.5 text-right tabular-nums">{brl(x.open.reduce((a, l) => a + l.value, 0))}</td>
                        <td className="py-1.5 text-right tabular-nums">{x.won.length}</td>
                        <td className={cn("py-1.5 text-right tabular-nums", x.late > 0 && "font-medium text-red-500")}>{x.late}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
