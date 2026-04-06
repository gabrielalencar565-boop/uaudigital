import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useHealthScores, type HealthScore } from "../hooks/use-health-scores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Cell, ReferenceLine, LabelList,
} from "recharts";
import { ShieldAlert, ShieldCheck, AlertTriangle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/* ── weights ── */
const WEIGHTS: Record<string, number> = {
  resultado_percebido: 3,
  alinhamento_estrategico: 3,
  comunicacao_atendimento: 2,
  qualidade_entregas: 2,
  satisfacao_geral: 2,
};
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

const DIM_LABELS: Record<string, string> = {
  resultado_percebido: "Resultado",
  alinhamento_estrategico: "Alinhamento",
  comunicacao_atendimento: "Comunicação",
  qualidade_entregas: "Qualidade",
  satisfacao_geral: "Satisfação",
};

function weightedAvg(s: HealthScore) {
  const w =
    s.resultado_percebido * WEIGHTS.resultado_percebido +
    s.alinhamento_estrategico * WEIGHTS.alinhamento_estrategico +
    s.comunicacao_atendimento * WEIGHTS.comunicacao_atendimento +
    s.qualidade_entregas * WEIGHTS.qualidade_entregas +
    s.satisfacao_geral * WEIGHTS.satisfacao_geral;
  return +(w / TOTAL_WEIGHT).toFixed(1);
}

function barColor(val: number) {
  if (val >= 9) return "#10B981";
  if (val >= 7) return "#F59E0B";
  return "#EF4444";
}

function classify(avg: number) {
  if (avg >= 9) return { label: "Saudável", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", Icon: ShieldCheck };
  if (avg >= 7) return { label: "Atenção", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", Icon: AlertTriangle };
  return { label: "Crítico", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", Icon: ShieldAlert };
}

/* ── types ── */
interface ClientScore {
  clientId: string;
  name: string;
  avg: number;
  cls: ReturnType<typeof classify>;
  dims: { name: string; value: number; color: string }[];
}

/* ═══════════════════════════════════════════════════════════
   Detail card – per-client bar chart
   ═══════════════════════════════════════════════════════════ */
function ClientDetailCard({ c }: { c: ClientScore }) {
  const { Icon } = c.cls;
  return (
    <Card>
      <CardContent className="py-5 px-5 space-y-4">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border", c.cls.bg)}>
              <Icon className={cn("h-4 w-4", c.cls.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground">Health Score (ponderado)</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className={cn("text-2xl font-extrabold tabular-nums", c.cls.color)}>{c.avg}</span>
            <p className={cn("text-[11px] font-semibold", c.cls.color)}>{c.cls.label}</p>
          </div>
        </div>

        {/* bar chart */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.dims} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 7, 8, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={7} stroke="#EF4444" strokeDasharray="6 3" strokeOpacity={0.6} label={{ value: "Risco", position: "right", fill: "#EF4444", fontSize: 10, fontWeight: 600 }} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                    <p className="font-bold text-foreground">{d.name}</p>
                    <p className="text-muted-foreground">Nota: <span className="font-semibold text-foreground">{d.value}/10</span></p>
                  </div>
                );
              }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                {c.dims.map((dim, i) => <Cell key={i} fill={dim.color} fillOpacity={0.85} />)}
                <LabelList dataKey="value" position="top" fill="hsl(var(--foreground))" fontSize={12} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   Ranking chart – horizontal bars sorted by risk
   ═══════════════════════════════════════════════════════════ */
function RankingChart({ data, onlyRisk }: { data: ClientScore[]; onlyRisk: boolean }) {
  const sorted = useMemo(() => {
    const list = onlyRisk ? data.filter((c) => c.avg < 9) : data;
    return [...list].sort((a, b) => a.avg - b.avg);
  }, [data, onlyRisk]);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">Nenhum cliente nessa faixa de risco.</p>
    );
  }

  const barH = Math.max(24, Math.min(36, 300 / sorted.length));
  const chartH = Math.max(200, sorted.length * (barH + 14) + 30);

  return (
    <div style={{ height: chartH }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 7, 8, 10]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <ReferenceLine x={7} stroke="#EF4444" strokeDasharray="6 3" strokeOpacity={0.5} />
          <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ClientScore;
            return (
              <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                <p className="font-bold text-foreground">{d.name}</p>
                <p className="text-muted-foreground">Score: <span className={cn("font-bold", d.cls.color)}>{d.avg}</span> — {d.cls.label}</p>
              </div>
            );
          }} />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={barH}>
            {sorted.map((c, i) => <Cell key={i} fill={barColor(c.avg)} fillOpacity={0.85} />)}
            <LabelList dataKey="avg" position="right" fill="hsl(var(--foreground))" fontSize={12} fontWeight={700} formatter={(v: number) => {
              const c = sorted.find((s) => s.avg === v);
              return c && c.avg < 7 ? `${v} ⚠ Em risco` : String(v);
            }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════ */
export function ChurnRiskChart() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const scoresQ = useHealthScores(month, year);
  const clientsQ = useQuery({
    queryKey: ["clients_active_churn"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false)
        .order("name");
      return data ?? [];
    },
  });

  const scores = scoresQ.data ?? [];
  const clients = clientsQ.data ?? [];

  const allClients: ClientScore[] = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.name]));
    return scores.map((s) => {
      const avg = weightedAvg(s);
      return {
        clientId: s.client_id,
        name: map.get(s.client_id) ?? "—",
        avg,
        cls: classify(avg),
        dims: Object.entries(DIM_LABELS).map(([k, l]) => ({
          name: l,
          value: s[k as keyof HealthScore] as number,
          color: barColor(s[k as keyof HealthScore] as number),
        })),
      };
    });
  }, [scores, clients]);

  const [selectedId, setSelectedId] = useState<string>("__all__");
  const [onlyRisk, setOnlyRisk] = useState(false);

  const selected = selectedId === "__all__" ? null : allClients.find((c) => c.clientId === selectedId) ?? null;

  const critical = allClients.filter((c) => c.avg < 7).length;
  const attention = allClients.filter((c) => c.avg >= 7 && c.avg < 9).length;
  const healthy = allClients.filter((c) => c.avg >= 9).length;

  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 py-6 px-5">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Risco de Churn</p>
            <p className="text-xs text-muted-foreground">Nenhuma avaliação de Health Score registrada para este mês.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Top bar: selector + badges ── */}
      <Card>
        <CardContent className="py-4 px-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold">Risco de Churn</p>
                <p className="text-xs text-muted-foreground">
                  {allClients.length} cliente{allClients.length !== 1 ? "s" : ""} avaliado{allClients.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os clientes</SelectItem>
                {allClients
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <SelectItem key={c.clientId} value={c.clientId}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: barColor(c.avg) }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* summary badges */}
          <div className="flex flex-wrap gap-2">
            {critical > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-semibold text-rose-500">{critical} crítico{critical !== 1 ? "s" : ""}</span>
              </div>
            )}
            {attention > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">{attention} atenção</span>
              </div>
            )}
            {healthy > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500">{healthy} saudável{healthy !== 1 ? "is" : ""}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Detail view (selected client) ── */}
      {selected && <ClientDetailCard c={selected} />}

      {/* ── Ranking chart ── */}
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold">Ranking de Risco</p>
              <p className="text-[11px] text-muted-foreground">Clientes ordenados do maior para o menor risco</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="only-risk" checked={onlyRisk} onCheckedChange={setOnlyRisk} className="scale-90" />
              <Label htmlFor="only-risk" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <Filter className="h-3 w-3" /> Só em risco
              </Label>
            </div>
          </div>

          <RankingChart data={allClients} onlyRisk={onlyRisk} />
        </CardContent>
      </Card>

      {/* ── All clients grid (when no specific client selected) ── */}
      {!selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allClients
            .slice()
            .sort((a, b) => a.avg - b.avg)
            .map((c) => (
              <ClientDetailCard key={c.clientId} c={c} />
            ))}
        </div>
      )}
    </div>
  );
}
