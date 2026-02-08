import { useEffect, useMemo, useState } from "react";
 import { Trophy, Edit, RefreshCw } from "lucide-react";
 
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 
 import { supabase } from "@/integrations/supabase/client";
 import { useSession } from "@/hooks/use-session";
 import { useRole } from "@/hooks/use-role";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { toast } from "sonner";
 import { useTeamMembers } from "@/features/data/queries";
 import { CategoryComparisonChart } from "@/features/performance/components/CategoryComparisonChart";
 import { Top3CompetencyRadar } from "@/features/performance/components/Top3CompetencyRadar";
 import { AdminDeadlineReport } from "@/features/performance/components/AdminDeadlineReport";
import { useNow } from "@/hooks/use-now";
 
 function initials(name: string) {
   return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
 }
 
 type ScoreRow = {
   user_id: string;
   year: number;
   month: number;
   aprendizado_continuo: number;
   padrao_qualidade_uau: number;
   metas_prazos: number;
   ambiente_organizado: number;
   comprometimento: number;
 };
 
const CRITERIA = [
  { key: "metas_prazos" as const, label: "Metas/Prazos", max: 3, desc: "Entregas no prazo vs atrasos" },
  { key: "padrao_qualidade_uau" as const, label: "Qualidade", max: 4, desc: "Nível das entregas, atenção aos detalhes e retrabalho" },
  { key: "comprometimento" as const, label: "Responsabilidade", max: 4, desc: "Comprometimento, postura profissional e confiabilidade" },
  { key: "ambiente_organizado" as const, label: "Organização", max: 3, desc: "Organização das tarefas, arquivos e do espaço de trabalho" },
  { key: "aprendizado_continuo" as const, label: "Aprendizado", max: 3, desc: "Evolução, busca ativa por novos conhecimentos e habilidades" },
];

const TOTAL_POINTS = 17;
 const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
 
 export function PerformancePanel() {
   const { user } = useSession();
   const { isAdmin } = useRole(user?.id);
   const queryClient = useQueryClient();
 
   const teamQ = useTeamMembers();
   const teamById = useMemo(() => new Map((teamQ.data ?? []).map((m) => [m.user_id, m])), [teamQ.data]);
 
    const now = useNow();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
 
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<"mensal" | "anual" | "relatorio">("mensal");
   const [editUserId, setEditUserId] = useState<string | null>(null);
   const [editValues, setEditValues] = useState<Partial<ScoreRow>>({});

  const [reportYear, setReportYear] = useState(currentYear);
  const [reportMonth, setReportMonth] = useState(currentMonth);

  // Mantém a tela sincronizada com o calendário (virada de mês/ano sem refresh)
  useEffect(() => {
    setYear(currentYear);
    setMonth(currentMonth);
    setReportYear(currentYear);
    setReportMonth(currentMonth);
  }, [currentMonth, currentYear]);

  const years = useMemo(() => {
    const y = currentYear;
    return [y - 1, y, y + 1];
  }, [currentYear]);
 
   const scoresQ = useQuery({
     queryKey: ["performance_scores", year, month],
     queryFn: async () => {
       const { data, error } = await supabase.from("performance_scores").select("*").eq("year", year).eq("month", month).order("user_id");
       if (error) throw error;
       return (data ?? []) as ScoreRow[];
     },
   });
 
   const annualQ = useQuery({
     queryKey: ["performance_scores_annual", year],
     queryFn: async () => {
       const { data, error } = await supabase.from("performance_scores").select("*").eq("year", year).order("month");
       if (error) throw error;
       return (data ?? []) as ScoreRow[];
     },
   });
 
   const saveMut = useMutation({
     mutationFn: async (row: ScoreRow) => {
       if (!user) throw new Error("Sem sessão");
       const { error } = await supabase.from("performance_scores").upsert(
         { ...row, created_by: user.id },
         { onConflict: "user_id,year,month" },
       );
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success("Salvo");
       queryClient.invalidateQueries({ queryKey: ["performance_scores"] });
       setEditUserId(null);
     },
     onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
   });
 
   const monthlyRank = useMemo(() => {
    const scores = scoresQ.data ?? [];
    const byUser = new Map(scores.map((s) => [s.user_id, s]));
    const members = teamQ.data ?? [];

    // Sempre mostrar colaboradores do time (com 0 pts caso ainda não exista linha em performance_scores)
    const base: Array<ScoreRow & { total: number }> = members.map((m) => {
      const s = byUser.get(m.user_id);
      const row: ScoreRow = {
        user_id: m.user_id,
        year,
        month,
        aprendizado_continuo: s?.aprendizado_continuo ?? 0,
        padrao_qualidade_uau: s?.padrao_qualidade_uau ?? 0,
        metas_prazos: s?.metas_prazos ?? 0,
        ambiente_organizado: s?.ambiente_organizado ?? 0,
        comprometimento: s?.comprometimento ?? 0,
      };
      const total =
        row.aprendizado_continuo +
        row.padrao_qualidade_uau +
        row.metas_prazos +
        row.ambiente_organizado +
        row.comprometimento;
      return { ...row, total };
    });

    base.sort((a, b) => b.total - a.total);
    return base;
  }, [scoresQ.data, teamQ.data, year, month]);
 
    const annualRank = useMemo(() => {
      const scores = annualQ.data ?? [];
      const members = teamQ.data ?? [];

      // Mantém o ranking anual consistente com a “base de responsáveis” do projeto:
      // só lista quem está em team_members (ativo), e nunca cai para mostrar user_id.
      const totalsByUser = new Map<string, { totalYear: number; highMonths: number; monthCount: number }>();

      for (const s of scores) {
        const pts = s.aprendizado_continuo + s.padrao_qualidade_uau + s.metas_prazos + s.ambiente_organizado + s.comprometimento;
        const prev = totalsByUser.get(s.user_id) ?? { totalYear: 0, highMonths: 0, monthCount: 0 };
        prev.totalYear += pts;
        prev.monthCount += 1;
        if (pts >= 7) prev.highMonths += 1;
        totalsByUser.set(s.user_id, prev);
      }

      const rows = members
        .map((m) => {
          const v = totalsByUser.get(m.user_id) ?? { totalYear: 0, highMonths: 0, monthCount: 0 };
          const avgMonth = v.monthCount ? Math.round((v.totalYear / v.monthCount) * 10) / 10 : 0;
          return { user_id: m.user_id, totalYear: v.totalYear, avgMonth, highMonths: v.highMonths };
        })
        .sort((a, b) => b.totalYear - a.totalYear);

      return rows;
    }, [annualQ.data, teamQ.data]);
 
    const top2 = monthlyRank.slice(0, 2);
    // 1º à esquerda, 2º à direita
    const podiumOrder = top2;
 
   const onEdit = (userId: string) => {
     const existing = (scoresQ.data ?? []).find((s) => s.user_id === userId);
     setEditValues({
       user_id: userId,
       year,
       month,
       aprendizado_continuo: existing?.aprendizado_continuo ?? 0,
       padrao_qualidade_uau: existing?.padrao_qualidade_uau ?? 0,
       metas_prazos: existing?.metas_prazos ?? 0,
       ambiente_organizado: existing?.ambiente_organizado ?? 0,
       comprometimento: existing?.comprometimento ?? 0,
     });
     setEditUserId(userId);
   };
 
   const onSave = () => {
     if (!editValues.user_id) return;
     saveMut.mutate(editValues as ScoreRow);
   };
 
  const podiumCardClass = (idx: number) => {
    // usa apenas tokens (primary/secondary/muted/border)
    if (idx === 0) return "bg-primary/5 border-primary/25 shadow-sm";
    if (idx === 1) return "bg-muted/20 border-border/60";
    return "bg-secondary/20 border-border/60";
  };

  const podiumMedal = (idx: number) => {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    return "🥉";
  };
 
   return (
     <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "mensal" | "anual" | "relatorio")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Ranking Mensal</h2>
              <p className="text-sm text-muted-foreground">Acompanhe o desempenho da equipe mês a mês</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["performance_scores"] });
                  queryClient.invalidateQueries({ queryKey: ["performance_scores_annual"] });
                  toast.success("Atualizado!");
                }}
                disabled={scoresQ.isFetching || annualQ.isFetching}
                title="Atualizar dados"
              >
                <RefreshCw className={`h-4 w-4 ${scoresQ.isFetching || annualQ.isFetching ? "animate-spin" : ""}`} />
              </Button>
              <TabsList className="bg-card/40">
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
                <TabsTrigger value="anual">Anual</TabsTrigger>
                {isAdmin ? <TabsTrigger value="relatorio">Relatório</TabsTrigger> : null}
              </TabsList>
            </div>
          </div>
 
         <TabsContent value="mensal" className="mt-6 space-y-6">
           <div className="flex flex-wrap gap-2">
             {MONTHS.map((m, idx) => (
               <Button
                 key={m}
                 variant={month === idx + 1 ? "default" : "outline"}
                 size="sm"
                 onClick={() => setMonth(idx + 1)}
                 className={month === idx + 1 ? "bg-primary text-primary-foreground" : ""}
               >
                 {m}
               </Button>
             ))}
           </div>
 
           {/* Pódio top 3 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
             {podiumOrder.map((row, displayIdx) => {
                const realIdx = top2.indexOf(row);
               const member = teamById.get(row.user_id);
                const position = realIdx === 0 ? "1º" : "2º";
                const isFirst = realIdx === 0;
                const orderClass = isFirst ? "md:order-1" : "md:order-2";
 
               return (
                  <Card
                    key={row.user_id}
                    className={`overflow-hidden border ${podiumCardClass(realIdx)} ${orderClass} ${isFirst ? "" : "md:mt-6"}`}
                  >
                    <CardContent className={`flex flex-col items-center text-center ${isFirst ? "p-7" : "p-4"}`}>
                      <div className="mb-4 grid place-items-center">
                        <div className={`grid place-items-center rounded-full border border-border/60 bg-card/40 ${isFirst ? "h-14 w-14" : "h-12 w-12"}`}>
                          <span className="text-2xl leading-none">{podiumMedal(realIdx)}</span>
                        </div>
                      </div>

                      <div className={`${isFirst ? "text-6xl" : "text-5xl"} font-semibold leading-none tracking-tight text-muted-foreground`}>
                        {position}
                      </div>

                      <div className="mt-4">
                        <Avatar className={`${isFirst ? "h-24 w-24" : "h-20 w-20"} shadow-sm`}>
                          <AvatarImage src={member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-lg">{initials(member?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="mt-4 space-y-2">
                        <p className={`${isFirst ? "text-2xl" : "text-xl"} font-semibold`}>{member?.display_name ?? row.user_id}</p>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className={`${isFirst ? "text-5xl" : "text-4xl"} font-bold text-primary tabular-nums`}>{row.total}</span>
                          <span className="text-base text-muted-foreground">pts</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
               );
             })}
           </div>
 
           {/* Tabela completa */}
           <Card>
              <CardContent className="p-0">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="w-12">#</TableHead>
                     <TableHead>Colaborador</TableHead>
                     {CRITERIA.map((c) => (
                       <TableHead key={c.key} className="text-center">{c.label}</TableHead>
                     ))}
                     <TableHead className="text-center font-semibold">Total</TableHead>
                     {isAdmin ? <TableHead className="w-16"></TableHead> : null}
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {monthlyRank.map((row, idx) => {
                     const member = teamById.get(row.user_id);
                     const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
 
                     return (
                       <TableRow key={row.user_id}>
                         <TableCell className="font-medium">
                           {medal ? <span className="text-xl">{medal}</span> : <span>{idx + 1}</span>}
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <Avatar className="h-8 w-8">
                               <AvatarImage src={member?.avatar_url ?? undefined} />
                               <AvatarFallback>{initials(member?.display_name ?? "?")}</AvatarFallback>
                             </Avatar>
                             <span className="font-medium">{member?.display_name ?? row.user_id}</span>
                           </div>
                         </TableCell>
                         {CRITERIA.map((c) => (
                           <TableCell key={c.key} className="text-center">
                             <Badge variant="secondary" className="rounded-full tabular-nums">{row[c.key]}</Badge>
                           </TableCell>
                         ))}
                         <TableCell className="text-center">
                           <span className="text-lg font-bold text-primary tabular-nums">{row.total}</span>
                         </TableCell>
                        {isAdmin ? (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(row.user_id)}
                              title="Editar pontuação"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
                {(teamQ.data?.length ?? 0) === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum colaborador cadastrado ainda — cada pessoa precisa criar conta em /auth e preencher Configurações.
                  </div>
                ) : null}
             </CardContent>
           </Card>

            {/* Dashboard */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo por Categoria</CardTitle>
                  <CardDescription>Comparação de pontos por critério (mês selecionado)</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryComparisonChart rows={monthlyRank} teamById={teamById} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Perfil de Competências — Top 3</CardTitle>
                  <CardDescription>Radar com os 3 melhores do mês</CardDescription>
                </CardHeader>
                <CardContent>
                  <Top3CompetencyRadar top3={monthlyRank.slice(0, 3)} teamById={teamById} />
                </CardContent>
              </Card>
            </div>
         </TabsContent>
 
         <TabsContent value="anual" className="mt-6">
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Trophy className="h-5 w-5" />
                 Ranking Anual {year}
               </CardTitle>
               <CardDescription>Total acumulado • Média mensal • Meses em High Performance</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-3">
                 {annualRank.map((row, idx) => {
                   const member = teamById.get(row.user_id);
                   const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
 
                   return (
                     <div key={row.user_id} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                       <div className="flex min-w-0 items-center gap-3">
                         {medal ? <span className="text-2xl">{medal}</span> : <span className="w-8 text-center text-muted-foreground">#{idx + 1}</span>}
                         <Avatar className="h-10 w-10">
                           <AvatarImage src={member?.avatar_url ?? undefined} />
                           <AvatarFallback>{initials(member?.display_name ?? "?")}</AvatarFallback>
                         </Avatar>
                         <div className="min-w-0">
                           <p className="truncate font-medium">{member?.display_name ?? row.user_id}</p>
                           <p className="truncate text-xs text-muted-foreground">{member?.role_title}</p>
                         </div>
                       </div>
                       <div className="flex flex-wrap items-center gap-3">
                         <div className="text-center">
                           <p className="text-2xl font-semibold tabular-nums">{row.totalYear}</p>
                           <p className="text-xs text-muted-foreground">Total ano</p>
                         </div>
                         <div className="text-center">
                           <p className="text-lg font-medium tabular-nums">{row.avgMonth}</p>
                           <p className="text-xs text-muted-foreground">Média/mês</p>
                         </div>
                         <div className="text-center">
                           <p className="text-lg font-medium tabular-nums">{row.highMonths}</p>
                           <p className="text-xs text-muted-foreground">Meses 🔥</p>
                         </div>
                       </div>
                     </div>
                   );
                 })}
                 {annualRank.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda neste ano.</p> : null}
               </div>
             </CardContent>
           </Card>
         </TabsContent>

        {isAdmin ? (
          <TabsContent value="relatorio" className="mt-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Relatório (Admin)</h2>
                <p className="text-sm text-muted-foreground">Entregas no prazo x atrasadas • Exceções por tarefa</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="w-full sm:w-[140px]">
                  <Select value={String(reportMonth)} onValueChange={(v) => setReportMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, idx) => (
                        <SelectItem key={m} value={String(idx + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-[140px]">
                  <Select value={String(reportYear)} onValueChange={(v) => setReportYear(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {user ? (
              <AdminDeadlineReport
                year={reportYear}
                month={reportMonth}
                team={teamQ.data ?? []}
                currentUserId={user.id}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">Faça login para ver o relatório.</CardContent>
              </Card>
            )}
          </TabsContent>
        ) : null}
       </Tabs>

       {/* Dialog de edição de pontuação */}
       <Dialog open={!!editUserId} onOpenChange={(open) => !open && setEditUserId(null)}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Editar Pontuação</DialogTitle>
             <DialogDescription>
               Ajuste os pontos de cada critério para{" "}
               <strong>{teamById.get(editUserId ?? "")?.display_name ?? "—"}</strong> em {MONTHS[month - 1]}/{year}
             </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             {CRITERIA.filter((c) => c.key !== "metas_prazos").map((c) => (
               <div key={c.key} className="flex items-center justify-between gap-4">
                 <div className="min-w-0 flex-1">
                   <Label className="font-medium">{c.label}</Label>
                   <p className="text-xs text-muted-foreground">{c.desc}</p>
                 </div>
                 <Input
                   type="number"
                   min={0}
                   max={c.max}
                   value={editValues[c.key] ?? 0}
                   onChange={(e) =>
                     setEditValues((v) => ({
                       ...v,
                       [c.key]: Math.min(c.max, Math.max(0, Number(e.target.value) || 0)),
                     }))
                   }
                   className="w-20 text-center tabular-nums"
                 />
               </div>
             ))}
             <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border/60 p-3 bg-muted/20">
               <div className="min-w-0 flex-1">
                 <Label className="font-medium">Metas/Prazos</Label>
                 <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
               </div>
               <Badge variant="secondary" className="tabular-nums">
                 {editValues.metas_prazos ?? 0}
               </Badge>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setEditUserId(null)}>
               Cancelar
             </Button>
             <Button
               variant="brand"
               onClick={onSave}
               disabled={saveMut.isPending}
             >
               {saveMut.isPending ? "Salvando..." : "Salvar"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 }