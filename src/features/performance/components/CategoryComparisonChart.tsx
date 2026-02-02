import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
type TeamMemberLite = {
  user_id: string;
  display_name: string;
  role_title?: string;
  avatar_url?: string | null;
};

export type CategoryComparisonRow = {
  user_id: string;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
};

export function CategoryComparisonChart({
  rows,
  teamById,
}: {
  rows: CategoryComparisonRow[];
  teamById: Map<string, TeamMemberLite>;
}) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        name: (teamById.get(r.user_id)?.display_name ?? "").split(" ")[0] || "—",
        aprendizado: r.aprendizado_continuo,
        qualidade: r.padrao_qualidade_uau,
        metas: r.metas_prazos,
        organizacao: r.ambiente_organizado,
        responsabilidade: r.comprometimento,
      })),
    [rows, teamById],
  );

  return (
    <ChartContainer
      className="h-[320px] w-full"
      config={{
        aprendizado: { label: "Aprendizado", color: "hsl(var(--primary))" },
        qualidade: { label: "Qualidade", color: "hsl(var(--brand))" },
        metas: { label: "Metas/Prazos", color: "hsl(var(--accent))" },
        organizacao: { label: "Organização", color: "hsl(var(--secondary))" },
        responsabilidade: { label: "Responsabilidade", color: "hsl(var(--muted-foreground))" },
      }}
    >
      <BarChart data={data} barCategoryGap={10} barGap={4} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={30} />
        <YAxis tickLine={false} axisLine={false} width={28} domain={["dataMin", "dataMax"]} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />

        <Bar dataKey="aprendizado" fill="var(--color-aprendizado)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="qualidade" fill="var(--color-qualidade)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="metas" fill="var(--color-metas)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="organizacao" fill="var(--color-organizacao)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="responsabilidade" fill="var(--color-responsabilidade)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
