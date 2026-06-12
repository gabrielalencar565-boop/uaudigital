import { useMemo } from "react";
import { Users, Phone, FileText, Calendar, CheckCircle2, XCircle, TrendingUp, Target } from "lucide-react";
import { FinMetricCard } from "@/features/financeiro/components/FinMetricCard";
import type { CrmLead } from "../hooks/use-crm-leads";

interface Props {
  leads: CrmLead[];
  proposalsEnviadas: number;
  reunioesMarcadas: number;
}

export function ComercialDashboard({ leads, proposalsEnviadas, reunioesMarcadas }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const novos = leads.filter((l) => new Date(l.created_at) >= monthStart && l.stage === "novo_lead").length;
    const emAtendimento = leads.filter((l) =>
      ["primeiro_contato", "qualificacao", "diagnostico", "follow_up"].includes(l.stage),
    ).length;
    const fechados = leads.filter((l) => l.stage === "fechado").length;
    const perdidos = leads.filter((l) => l.stage === "perdido").length;
    const faturamentoPrev = leads
      .filter((l) => !["fechado", "perdido"].includes(l.stage))
      .reduce((s, l) => s + (Number(l.valor_estimado) || 0), 0);
    const totalConcluidos = fechados + perdidos;
    const conversao = totalConcluidos > 0 ? (fechados / totalConcluidos) * 100 : 0;

    return { novos, emAtendimento, fechados, perdidos, faturamentoPrev, conversao };
  }, [leads]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <FinMetricCard title="Leads novos (mês)" value={stats.novos} prefix="" decimals={0} icon={<Users className="h-4 w-4" />} />
      <FinMetricCard title="Em atendimento" value={stats.emAtendimento} prefix="" decimals={0} icon={<Phone className="h-4 w-4" />} />
      <FinMetricCard title="Propostas enviadas" value={proposalsEnviadas} prefix="" decimals={0} icon={<FileText className="h-4 w-4" />} />
      <FinMetricCard title="Reuniões marcadas" value={reunioesMarcadas} prefix="" decimals={0} icon={<Calendar className="h-4 w-4" />} />
      <FinMetricCard title="Clientes fechados" value={stats.fechados} prefix="" decimals={0} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      <FinMetricCard title="Vendas perdidas" value={stats.perdidos} prefix="" decimals={0} tone="danger" icon={<XCircle className="h-4 w-4" />} />
      <FinMetricCard title="Faturamento previsto" value={stats.faturamentoPrev} decimals={0} tone="success" icon={<TrendingUp className="h-4 w-4" />} />
      <FinMetricCard title="Taxa de conversão" value={stats.conversao} prefix="" suffix="%" decimals={1} tone="default" icon={<Target className="h-4 w-4" />} />
    </div>
  );
}
