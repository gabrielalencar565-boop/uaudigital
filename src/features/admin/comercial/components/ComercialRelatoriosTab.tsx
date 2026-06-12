import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { STAGES, STAGE_LABEL, LOSS_LABEL, fmtCurrency } from "../crm-constants";
import { useCrmLeads } from "../hooks/use-crm-leads";
import { useCrmProposals } from "../hooks/use-crm-proposals";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6", "#84cc16"];

export function ComercialRelatoriosTab({ members }: { members: { user_id: string; display_name: string }[] }) {
  const { data: leads = [] } = useCrmLeads();
  const { data: proposals = [] } = useCrmProposals();

  const conversaoEtapa = useMemo(() => STAGES.map((s) => ({
    name: s.label, value: leads.filter((l) => l.stage === s.value).length,
  })), [leads]);

  const leadsOrigem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const k = l.origem || "—";
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const vendasResp = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads.filter((x) => x.stage === "fechado")) {
      const k = l.responsavel_id || "sem";
      map[k] = (map[k] ?? 0) + (Number(l.valor_estimado) || 0);
    }
    return Object.entries(map).map(([k, v]) => ({
      name: members.find((m) => m.user_id === k)?.display_name ?? "Sem responsável",
      value: v,
    }));
  }, [leads, members]);

  const motivosPerda = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads.filter((x) => x.stage === "perdido" && x.loss_reason)) {
      const k = LOSS_LABEL[l.loss_reason!];
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [leads]);

  const fechados = leads.filter((l) => l.stage === "fechado");
  const ticketMedio = fechados.length > 0
    ? fechados.reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0) / fechados.length
    : 0;
  const previsao = leads.filter((l) => !["fechado", "perdido"].includes(l.stage))
    .reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Kpi title="Ticket médio" value={fmtCurrency(ticketMedio)} />
        <Kpi title="Previsão de faturamento" value={fmtCurrency(previsao)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Conversão por etapa">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={conversaoEtapa}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} height={60} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads por origem">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={leadsOrigem} dataKey="value" nameKey="name" outerRadius={90} label>
                {leadsOrigem.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendas por responsável (R$)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={vendasResp} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Motivos de perda">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={motivosPerda} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
