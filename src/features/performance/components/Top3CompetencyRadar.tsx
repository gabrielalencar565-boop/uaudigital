import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
type TeamMemberLite = {
  user_id: string;
  display_name: string;
  role_title?: string;
  avatar_url?: string | null;
};

export type RadarRow = {
  user_id: string;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
};

export function Top3CompetencyRadar({
  top3,
  teamById,
}: {
  top3: RadarRow[];
  teamById: Map<string, TeamMemberLite>;
}) {
  const series = useMemo(() => {
    const picked = top3.slice(0, 3);
    return picked.map((r, idx) => {
      const name = teamById.get(r.user_id)?.display_name ?? `Top ${idx + 1}`;
      return { key: `u${idx + 1}`, name, row: r };
    });
  }, [top3, teamById]);

  const data = useMemo(() => {
    const r0 = series[0]?.row;
    const r1 = series[1]?.row;
    const r2 = series[2]?.row;

    return [
      {
        subject: "Aprendizado",
        u1: r0?.aprendizado_continuo ?? 0,
        u2: r1?.aprendizado_continuo ?? 0,
        u3: r2?.aprendizado_continuo ?? 0,
      },
      {
        subject: "Qualidade",
        u1: r0?.padrao_qualidade_uau ?? 0,
        u2: r1?.padrao_qualidade_uau ?? 0,
        u3: r2?.padrao_qualidade_uau ?? 0,
      },
      {
        subject: "Metas/Prazos",
        u1: r0?.metas_prazos ?? 0,
        u2: r1?.metas_prazos ?? 0,
        u3: r2?.metas_prazos ?? 0,
      },
      {
        subject: "Organização",
        u1: r0?.ambiente_organizado ?? 0,
        u2: r1?.ambiente_organizado ?? 0,
        u3: r2?.ambiente_organizado ?? 0,
      },
      {
        subject: "Responsabilidade",
        u1: r0?.comprometimento ?? 0,
        u2: r1?.comprometimento ?? 0,
        u3: r2?.comprometimento ?? 0,
      },
    ];
  }, [series]);

  const config = useMemo(
    () => ({
      u1: { label: series[0]?.name ?? "Top 1", color: "hsl(var(--primary))" },
      u2: { label: series[1]?.name ?? "Top 2", color: "hsl(var(--brand))" },
      u3: { label: series[2]?.name ?? "Top 3", color: "hsl(var(--accent))" },
    }),
    [series],
  );

  return (
    <ChartContainer className="h-[320px] w-full" config={config}>
      <RadarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" />
        <PolarRadiusAxis domain={["dataMin", "dataMax"]} tickCount={5} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />

        {series[0] ? <Radar dataKey="u1" stroke="var(--color-u1)" fill="var(--color-u1)" fillOpacity={0.2} /> : null}
        {series[1] ? <Radar dataKey="u2" stroke="var(--color-u2)" fill="var(--color-u2)" fillOpacity={0.18} /> : null}
        {series[2] ? <Radar dataKey="u3" stroke="var(--color-u3)" fill="var(--color-u3)" fillOpacity={0.16} /> : null}
      </RadarChart>
    </ChartContainer>
  );
}
