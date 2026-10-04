import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, MousePointerClick, ScanSearch, Sparkles, TrendingUp, Users } from "lucide-react";

import { brandChartDefs, useBrandGradientIds } from "@/components/metrics/BrandChartDefs";
import { GradientBar } from "@/components/ui/gradient-bar";
import { Tooltip as InfoTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MetricSparkCard } from "@/features/meu-painel/components/MetricSparkCard";
import { brandGradientCss, brandSeriesColor } from "@/lib/brand-gradient";
import { cn } from "@/lib/utils";
import {
  CADENCE_BUCKETS, FORMAT_LABELS, GENDER_LABELS, SLOTS, WEEKDAYS,
  buildNarrative, computeBestTimes, computeCadence, computeSummary, formatTotals, postsWithin,
  slotRange, sortAges, toPercentList, weekdayName,
  type DateRange, type ReportData,
} from "../lib/report-metrics";
import { AudienceMap } from "./AudienceMap";
import { TopContent } from "./TopContent";

const compactNumber = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function Delta({ value, unit }: { value: number | null; unit: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">sem comparação ainda</span>;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="text-muted-foreground">0{unit} vs. anterior</span>;
  return (
    <span className={rounded > 0 ? "font-medium text-emerald-500" : "font-medium text-red-500"}>
      {rounded > 0 ? "+" : ""}
      {rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {unit}
    </span>
  );
}

function Section({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("break-inside-avoid rounded-2xl border border-border/40 bg-card p-5", className)}>
      <div className="mb-4">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PercentRows({ rows }: { rows: { label: string; pct: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.pct));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted-foreground" title={r.label}>{r.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(r.pct / max) * 100}%`, background: brandGradientCss(90) }} />
          </div>
          <span className="w-10 text-right tabular-nums">{Math.round(r.pct)}%</span>
        </div>
      ))}
    </div>
  );
}

function AudienceSection({ audience }: { audience: ReportData["audience"] }) {
  const gender = toPercentList(audience?.gender).map((g) => ({ ...g, label: GENDER_LABELS[g.label] ?? g.label }));
  const ages = sortAges(toPercentList(audience?.age));
  if (gender.length === 0 && ages.length === 0) {
    return <p className="text-sm text-muted-foreground">A demografia da audiência ainda não está disponível para este perfil.</p>;
  }
  const lead = gender[0];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={gender} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={4} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
                {gender.map((g, i) => <Cell key={g.label} fill={brandSeriesColor(i)} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {lead && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-lg font-bold leading-none">{Math.round(lead.pct)}%</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{lead.label.toLowerCase()}</p>
              </div>
            </div>
          )}
        </div>
        <ul className="min-w-[8.5rem] flex-1 space-y-1.5 text-xs">
          {gender.map((g, i) => (
            <li key={g.label} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: brandSeriesColor(i) }} />
              <span className="text-muted-foreground">{g.label}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{Math.round(g.pct)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">Faixa etária</p>
        <PercentRows rows={ages} />
      </div>
    </div>
  );
}

function BestTimesSection({ media }: { media: ReportData["media"] }) {
  const best = useMemo(() => computeBestTimes(media), [media]);
  // Hover/focus opens a cell's info card (Radix reports it via onOpenChange); a click pins it so it also
  // works on touch screens, and any click outside a cell un-pins it.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!pinnedKey) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-heat-cell]")) setPinnedKey(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinnedKey]);

  if (best.posts < 3) return <p className="text-sm text-muted-foreground">Ainda não há posts suficientes para indicar os melhores momentos.</p>;
  return (
    <>
      <div className="space-y-1">
        <div className="grid grid-cols-[2rem_repeat(6,1fr)] gap-1 text-[10px] text-muted-foreground">
          <span />
          {SLOTS.map((s) => <span key={s} className="text-center">{s}</span>)}
        </div>
        {WEEKDAYS.map((d, di) => (
          <div key={d} className="grid grid-cols-[2rem_repeat(6,1fr)] gap-1">
            <span className="self-center text-[10px] text-muted-foreground">{d}</span>
            {best.grid[di].map((c, si) => {
              const key = `${di}-${si}`;
              return (
                <InfoTooltip key={key} open={pinnedKey ? pinnedKey === key : hoverKey === key} onOpenChange={(o) => setHoverKey(o ? key : null)}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-heat-cell
                      aria-label={`${weekdayName(di)}, ${slotRange(si)}`}
                      onClick={() => setPinnedKey((prev) => (prev === key ? null : key))}
                      className={cn("h-5 rounded-md outline-none transition-transform hover:scale-y-110 focus-visible:ring-2 focus-visible:ring-violet-500", c.n === 0 && "bg-muted/40")}
                      style={c.n > 0 ? { background: `rgba(109, 60, 240, ${0.12 + (c.avg / best.maxCell) * 0.8})` } : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="w-60 space-y-2 p-3 text-xs">
                    <div>
                      <p className="text-sm font-semibold first-letter:uppercase">{weekdayName(di)}</p>
                      <p className="text-muted-foreground">Das {slotRange(si)} (horário de Brasília)</p>
                    </div>
                    {c.n === 0 ? (
                      <p className="text-muted-foreground">Nenhum post foi publicado neste horário.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-base font-bold tabular-nums">{c.n}</p>
                            <p className="text-[10px] text-muted-foreground">{c.n === 1 ? "post" : "posts"}</p>
                          </div>
                          <div>
                            <p className="text-base font-bold tabular-nums">{compactNumber(c.avg)}</p>
                            <p className="text-[10px] text-muted-foreground">alcance médio</p>
                          </div>
                          <div>
                            <p className="text-base font-bold tabular-nums">{c.avgInteractions != null ? compactNumber(c.avgInteractions) : "—"}</p>
                            <p className="text-[10px] text-muted-foreground">interações médias</p>
                          </div>
                        </div>
                        {c.top && (
                          <div className="border-t border-border/50 pt-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Melhor post deste horário</p>
                            <p className="mt-0.5 line-clamp-2">{c.top.caption || FORMAT_LABELS[c.top.content_type ?? "post"] || "Post"}</p>
                            <p className="mt-0.5 text-muted-foreground">
                              {compactNumber(c.top.reach ?? 0)} de alcance
                              {c.top.posted_at ? ` · ${new Date(c.top.posted_at).toLocaleDateString("pt-BR")}` : ""}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </TooltipContent>
                </InfoTooltip>
              );
            })}
          </div>
        ))}
      </div>
      {best.bestDay !== null && best.bestSlot !== null && (
        <p className="mt-3 text-xs text-emerald-600">
          Melhor dia: <b>{weekdayName(best.bestDay)}</b> · melhor horário: <b>por volta das {SLOTS[best.bestSlot]}</b>
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">Alcance médio por post, com base em {best.posts} posts (horário de Brasília). Passe o mouse ou clique num bloco para ver os detalhes.</p>
    </>
  );
}

function CadenceSection({ media }: { media: ReportData["media"] }) {
  const cadence = useMemo(() => computeCadence(media), [media]);
  const withData = cadence.buckets.filter((b) => b.weeks > 0);
  if (cadence.totalWeeks < 3 || withData.length < 2) return <p className="text-sm text-muted-foreground">Ainda não há semanas suficientes para comparar a frequência.</p>;
  const max = Math.max(...withData.map((b) => b.avgReach));
  return (
    <>
      <div className="flex h-32 gap-3">
        {CADENCE_BUCKETS.map((def) => {
          const b = cadence.buckets.find((x) => x.label === def.label)!;
          return (
            <div key={b.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-muted-foreground">{b.weeks > 0 ? compactNumber(b.avgReach) : "—"}</span>
              <div className="flex w-full flex-1 items-end">
                {b.weeks > 0 && (
                  <div className="w-full rounded-t-lg" style={{ height: `${Math.max(6, (b.avgReach / max) * 100)}%`, background: "linear-gradient(0deg, #6d3cf0, #c86be6 55%, #f5b27a)" }} />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{b.label}</span>
            </div>
          );
        })}
      </div>
      {cadence.best && (
        <p className="mt-3 text-xs text-emerald-600">Semanas com <b>{cadence.best.label}</b> tiveram o maior alcance por post.</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">Alcance médio por post conforme quantos posts saíram na semana ({cadence.totalWeeks} semanas analisadas).</p>
    </>
  );
}

function FormatRanking({ media }: { media: ReportData["media"] }) {
  const rows = useMemo(() => formatTotals(media), [media]);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum post com métricas neste período.</p>;
  const max = rows[0].reach;
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.type} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span>{FORMAT_LABELS[r.type] ?? r.type}</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" /> {compactNumber(r.reach)}
            </span>
          </div>
          <GradientBar value={(r.reach / max) * 100} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Alcance somado de {media.length} {media.length === 1 ? "post" : "posts"}.</p>
    </div>
  );
}

export function ReportView({ data, range, mode }: { data: ReportData; range: DateRange; mode: "internal" | "public" }) {
  const gradientIds = useBrandGradientIds();
  const periodMedia = useMemo(() => postsWithin(data.media, range), [data.media, range]);
  const summary = useMemo(() => computeSummary(data.snapshots, data.media, range), [data.snapshots, data.media, range]);
  const narrative = useMemo(() => buildNarrative({ range, summary, periodMedia, allMedia: data.media }), [range, summary, periodMedia, data.media]);

  const chartData = useMemo(
    () =>
      data.snapshots
        .filter((s) => s.reach != null && s.snapshot_date >= range.from && s.snapshot_date <= range.to)
        .map((s) => ({ date: s.snapshot_date.slice(8, 10) + "/" + s.snapshot_date.slice(5, 7), reach: s.reach })),
    [data.snapshots, range],
  );
  const firstReachDate = data.snapshots.find((s) => s.reach != null)?.snapshot_date ?? null;
  const partialCoverage = firstReachDate !== null && firstReachDate > range.from;

  const cover = (covered: number) => (covered < range.days && covered > 0 ? ` Dados coletados de ${covered} dos ${range.days} dias.` : "");

  return (
    <div className="space-y-5">
      {mode === "public" && (
        <div className="flex items-center gap-4">
          {data.client.logo_url ? (
            <img src={data.client.logo_url} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-border" />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full text-xl font-bold text-white" style={{ background: brandGradientCss(135) }}>
              {data.client.name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-500">Relatório do Instagram</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">{data.client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {data.client.instagram_username ? `@${data.client.instagram_username} · ` : ""}{range.label.toLowerCase()} · gerado em {new Date(data.generatedAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <MetricSparkCard
            label="Alcance"
            value={summary.reach.value}
            icon={<Eye className="h-5 w-5" />}
            tone="violet"
            description={`Contas diferentes que viram o conteúdo ${range.phrase}.${cover(summary.reach.days)}`}
            footer={<Delta value={summary.reach.delta} unit="%" />}
          />
        </div>
        <div className="lg:col-span-2">
          <MetricSparkCard
            label="Visualizações"
            value={summary.views.value}
            icon={<ScanSearch className="h-5 w-5" />}
            tone="amber"
            description={`Quantas vezes os conteúdos foram vistos (uma mesma pessoa pode ver mais de uma vez).${cover(summary.views.days)}`}
            footer={<Delta value={summary.views.delta} unit="%" />}
          />
        </div>
        <div className="col-span-2 lg:col-span-2">
          <MetricSparkCard
            label="Visitas ao perfil"
            value={summary.profileViews.value}
            icon={<Users className="h-5 w-5" />}
            tone="violet"
            description={`Quantas vezes o perfil foi aberto.${cover(summary.profileViews.days)}`}
            footer={<Delta value={summary.profileViews.delta} unit="%" />}
          />
        </div>
        <div className="lg:col-span-3">
          <MetricSparkCard
            label="Cliques no link"
            value={summary.linkTaps.value}
            icon={<MousePointerClick className="h-5 w-5" />}
            tone="amber"
            description={`Toques no link da bio do perfil.${cover(summary.linkTaps.days)}`}
            footer={<Delta value={summary.linkTaps.delta} unit="%" />}
          />
        </div>
        <div className="lg:col-span-3">
          <MetricSparkCard
            label="Seguidores"
            value={summary.followers ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="emerald"
            description={`Total atual de seguidores. A variação mostra o saldo de novos seguidores no período.${cover(0)}`}
            footer={
              summary.newFollowers === null ? (
                <span className="text-muted-foreground">sem comparação ainda</span>
              ) : (
                <Delta value={summary.newFollowers} unit=" no período" />
              )
            }
          />
        </div>
      </div>

      <Section title="Crescimento de alcance" hint="Quantas contas diferentes foram alcançadas a cada dia.">
        {chartData.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem dados ainda para este período.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                {brandChartDefs(gradientIds)}
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} tickFormatter={(v: number) => compactNumber(v)} />
                <Tooltip
                  formatter={(v: number) => [v.toLocaleString("pt-BR"), "Alcance"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Area type="monotone" dataKey="reach" stroke={`url(#${gradientIds.h})`} strokeWidth={2.5} fill={`url(#${gradientIds.area})`} isAnimationActive={mode === "internal"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {partialCoverage && chartData.length >= 2 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Histórico disponível desde {firstReachDate!.slice(8, 10)}/{firstReachDate!.slice(5, 7)}. O Instagram informa só 28 dias por vez; o restante vai sendo guardado a cada atualização.
          </p>
        )}
      </Section>

      <Section title="Perfil da audiência" hint="Quem são os seguidores da conta.">
        <AudienceSection audience={data.audience} />
      </Section>

      <Section title="Onde estão seus seguidores" hint="As cidades que concentram a audiência.">
        <AudienceMap cities={data.audience?.city} geo={data.audience?.city_geo} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Melhores dias e horários" hint="Quando as publicações costumam alcançar mais gente.">
          <BestTimesSection media={data.media} />
        </Section>
        <Section title="Frequência de postagem" hint="Postar mais compensa? Compara o alcance por post conforme o ritmo da semana.">
          <CadenceSection media={data.media} />
        </Section>
      </div>

      <Section title="O que mais funcionou" hint="Alcance somado de cada formato de conteúdo no período.">
        <FormatRanking media={periodMedia} />
      </Section>

      <Section title="Melhores conteúdos" hint="Os 5 posts que mais alcançaram pessoas no período.">
        <TopContent media={periodMedia} />
      </Section>

      {narrative.length > 0 && (
        <div className="break-inside-avoid rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-transparent to-orange-300/10 p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-violet-500" /> Resumo do período
          </p>
          <div className="space-y-2 text-sm leading-relaxed">
            {narrative.map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
