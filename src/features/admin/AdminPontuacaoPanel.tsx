import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ScoringRow = {
  id: string;
  stage: string;
  label: string;
  base_points: number;
  late_penalty: number;
  uses_quantity: boolean;
  extra_demand_multiplier: number;
};

type EditState = Record<string, Partial<ScoringRow>>;

export function AdminPontuacaoPanel() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<EditState>({});

  const configQ = useQuery({
    queryKey: ["scoring_config"],
    queryFn: async (): Promise<ScoringRow[]> => {
      const { data, error } = await supabase
        .from("scoring_config")
        .select("id, stage, label, base_points, late_penalty, uses_quantity, extra_demand_multiplier")
        .order("stage");
      if (error) throw error;
      return (data ?? []) as ScoringRow[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(edits);
      if (entries.length === 0) return;

      for (const [id, changes] of entries) {
        const { error } = await supabase
          .from("scoring_config")
          .update(changes)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      setEdits({});
      await qc.invalidateQueries({ queryKey: ["scoring_config"] });
      toast.success("Pontuação atualizada!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const rows = configQ.data ?? [];
  const hasEdits = Object.keys(edits).length > 0;

  function getVal<K extends keyof ScoringRow>(row: ScoringRow, key: K): ScoringRow[K] {
    return (edits[row.id]?.[key] ?? row[key]) as ScoringRow[K];
  }

  function setVal<K extends keyof ScoringRow>(row: ScoringRow, key: K, value: ScoringRow[K]) {
    setEdits((prev) => ({
      ...prev,
      [row.id]: { ...prev[row.id], [key]: value },
    }));
  }

  // Order stages nicely
  const magicStages = ["planejamento", "captacao", "edicao_videos", "design", "pdf", "alteracoes", "agendamento"];
  const sorted = [...rows]
    .filter((r) => magicStages.includes(r.stage))
    .sort((a, b) => magicStages.indexOf(a.stage) - magicStages.indexOf(b.stage));

  // Tag-based scoring entries
  const tagStages = ["tag_post", "tag_carrossel", "tag_capa", "tag_video_curto", "tag_video"];
  const tagRows = [...rows]
    .filter((r) => tagStages.includes(r.stage))
    .sort((a, b) => tagStages.indexOf(a.stage) - tagStages.indexOf(b.stage));

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-semibold tracking-tight">Pontuação</h2>
        <p className="text-sm text-muted-foreground">
          Configure os pontos de cada etapa para o cálculo de Metas/Prazos no desempenho.
        </p>
      </div>

      <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critérios por etapa</CardTitle>
          <CardDescription>
            Altere os valores e clique em Salvar. Etapas com "Usa quantidade" multiplicam os pontos base pela quantidade de demandas na tarefa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {!configQ.isLoading && (
            <>
              <div className="rounded-lg border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead className="text-center w-[100px]">Pontos base</TableHead>
                      <TableHead className="text-center w-[100px]">Penalidade atraso</TableHead>
                      <TableHead className="text-center w-[90px]">Usa quantidade</TableHead>
                      <TableHead className="text-center w-[120px]">Multiplicador extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getVal(row, "label")}</span>
                            <Badge variant="outline" className="text-[10px]">{row.stage}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.5"
                            className="w-20 mx-auto text-center h-8 tabular-nums"
                            value={getVal(row, "base_points")}
                            onChange={(e) => setVal(row, "base_points", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.5"
                            className="w-20 mx-auto text-center h-8 tabular-nums"
                            value={getVal(row, "late_penalty")}
                            onChange={(e) => setVal(row, "late_penalty", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={getVal(row, "uses_quantity")}
                            onCheckedChange={(v) => setVal(row, "uses_quantity", v)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.1"
                            className="w-20 mx-auto text-center h-8 tabular-nums"
                            value={getVal(row, "extra_demand_multiplier")}
                            onChange={(e) => setVal(row, "extra_demand_multiplier", Number(e.target.value))}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  variant="brand"
                  disabled={!hasEdits || saveMut.isPending}
                  onClick={() => saveMut.mutate()}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveMut.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
