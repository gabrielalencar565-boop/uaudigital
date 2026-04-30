import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TAG_COLORS, tagColor, isHexColor } from "@/features/gestao/pm-constants";
import { usePmTags, useDeletePmTag } from "@/features/gestao/hooks/use-pm-tags";
import { normalizePmTagStageKey } from "@/features/gestao/utils/normalize-pm-tag-stage";

const sb = supabase as any;

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
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");
  const [newStageName, setNewStageName] = useState("");

  // Normalize a stage label to "custom_<slug>"
  function makeCustomStageKey(name: string) {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return `custom_${slug}`;
  }

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

  const { data: globalTags = [] } = usePmTags();
  const deleteGlobalTag = useDeletePmTag();

  const saveMut = useMutation({
    mutationFn: async () => {
      // Filter out any entries with invalid/undefined IDs
      const entries = Object.entries(edits).filter(([id]) => id && id !== "undefined" && id.length > 8);
      if (entries.length === 0) return;

      // 1. Snapshot: congela pontuação de tarefas já concluídas
      const { data: snapshotCount, error: snapErr } = await sb.rpc("snapshot_unscored_tasks");
      if (snapErr) throw snapErr;

      // 2. Atualiza os critérios
      for (const [id, changes] of entries) {
        const { error } = await supabase
          .from("scoring_config")
          .update(changes)
          .eq("id", id);
        if (error) throw error;
      }

      return snapshotCount as number;
    },
    onSuccess: async (count) => {
      setEdits({});
      await qc.invalidateQueries({ queryKey: ["scoring_config"] });
      if (count && count > 0) {
        toast.success(`Pontuação atualizada! ${count} tarefa(s) anterior(es) protegida(s).`);
      } else {
        toast.success("Pontuação atualizada!");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const createTagMut = useMutation({
    mutationFn: async ({ name, color_key }: { name: string; color_key: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1. Create pm_tags entry
      const { error: tagErr } = await sb
        .from("pm_tags")
        .insert({ name, color_key, created_by: user.id });
      if (tagErr) throw tagErr;

      // 2. Create scoring_config entry
      const stageKey = normalizePmTagStageKey(name);
      const { error: scoreErr } = await sb
        .from("scoring_config")
        .insert({
          stage: stageKey,
          label: name,
          base_points: 1,
          late_penalty: -1,
          uses_quantity: false,
          extra_demand_multiplier: 1.5,
          updated_by: user.id,
        });
      if (scoreErr) throw scoreErr;
    },
    onSuccess: () => {
      setNewTagName("");
      setNewTagColor("blue");
      qc.invalidateQueries({ queryKey: ["pm_tags"] });
      qc.invalidateQueries({ queryKey: ["scoring_config"] });
      toast.success("Etiqueta criada!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar etiqueta"),
  });

  const deleteTagWithScoring = useMutation({
    mutationFn: async (gt: { id: string; name: string; color_key: string }) => {
      const tagValue = `${gt.name}:${gt.color_key}`;

      // 1. Delete pm_tags entry (also cleans pm_tasks via useDeletePmTag logic)
      const { error: tagErr } = await sb.from("pm_tags").delete().eq("id", gt.id);
      if (tagErr) throw tagErr;

      // Remove from all pm_tasks
      const { data: tasksWithTag } = await sb
        .from("pm_tasks")
        .select("id, tags")
        .contains("tags", [tagValue]);
      if (tasksWithTag && tasksWithTag.length > 0) {
        for (const t of tasksWithTag) {
          const newTags = (t.tags ?? []).filter((tag: string) => tag !== tagValue);
          await sb.from("pm_tasks").update({ tags: newTags }).eq("id", t.id);
        }
      }

      // 2. Delete scoring_config entry
      const stageKey = normalizePmTagStageKey(gt.name);
      await sb.from("scoring_config").delete().eq("stage", stageKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tags"] });
      qc.invalidateQueries({ queryKey: ["scoring_config"] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      toast.success("Etiqueta removida!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover etiqueta"),
  });

  const createCustomStageMut = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const stageKey = makeCustomStageKey(name);
      if (!stageKey.replace("custom_", "")) throw new Error("Nome inválido");

      // Check duplicate
      const { data: existing } = await sb
        .from("scoring_config")
        .select("id")
        .eq("stage", stageKey)
        .maybeSingle();
      if (existing) throw new Error("Etapa já existe");

      const { error } = await sb.from("scoring_config").insert({
        stage: stageKey,
        label: name.trim(),
        base_points: 1,
        late_penalty: -1,
        uses_quantity: false,
        extra_demand_multiplier: 1.5,
        updated_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewStageName("");
      qc.invalidateQueries({ queryKey: ["scoring_config"] });
      toast.success("Etapa periódica criada!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar etapa"),
  });

  const deleteCustomStageMut = useMutation({
    mutationFn: async (stage: string) => {
      if (!stage.startsWith("custom_")) throw new Error("Apenas etapas periódicas podem ser removidas");
      const { error } = await sb.from("scoring_config").delete().eq("stage", stage);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scoring_config"] });
      toast.success("Etapa removida!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover etapa"),
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

  // Order stages nicely — design and edicao_videos are excluded (scoring defined by tags only)
  const magicStages = ["planejamento", "captacao", "pdf", "alteracoes", "agendamento"];
  const fixedRows = [...rows]
    .filter((r) => magicStages.includes(r.stage))
    .sort((a, b) => magicStages.indexOf(a.stage) - magicStages.indexOf(b.stage));
  const customRows = [...rows]
    .filter((r) => r.stage.startsWith("custom_"))
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  const sorted = [...fixedRows, ...customRows];

  // Tag-based scoring entries
  const tagRows = [...rows]
    .filter((r) => r.stage.startsWith("tag_"))
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const newTagKey = normalizePmTagStageKey(newTagName);
    const exists = globalTags.some((gt) => normalizePmTagStageKey(gt.name) === newTagKey);
    if (exists) {
      toast.error("Etiqueta já existe!");
      return;
    }
    createTagMut.mutate({ name: newTagName.trim(), color_key: newTagColor });
  };

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-semibold tracking-tight">Pontuação</h2>
      </div>

      <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critérios por etapa</CardTitle>
          <CardDescription>
            Altere os valores e clique em Salvar. As etapas <strong>Design</strong> e <strong>Vídeo</strong> não aparecem aqui — a pontuação dessas etapas é definida exclusivamente pelas <strong>etiquetas</strong> abaixo.
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
                      <TableHead className="text-center w-[60px]"></TableHead>
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

      <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.3s" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Etiquetas e Pontuação</CardTitle>
          <CardDescription>
            Crie e gerencie etiquetas globais. Cada etiqueta terá sua pontuação configurável abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new tag */}
          <div className="flex items-end gap-3 p-3 rounded-lg border border-dashed border-border/60 bg-muted/20">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nova etiqueta</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da etiqueta..."
                className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 shrink-0 rounded-full ring-1 ring-border/60 hover:ring-foreground/40 transition-all hover:scale-105"
                  style={isHexColor(newTagColor) ? { backgroundColor: newTagColor } : undefined}
                  aria-label="Escolher cor"
                >
                  {!isHexColor(newTagColor) && (
                    <span
                      className={cn(
                        "block h-full w-full rounded-full",
                        TAG_COLORS.find(c => c.key === newTagColor)?.dot ?? "bg-blue-500"
                      )}
                    />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 space-y-2" align="end">
                <div className="grid grid-cols-5 gap-1.5">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      title={c.label}
                      className={cn(
                        "h-5 w-5 rounded-full transition-all",
                        c.dot,
                        newTagColor === c.key
                          ? "ring-2 ring-offset-2 ring-offset-background ring-white/50 scale-110"
                          : "opacity-70 hover:opacity-100 hover:scale-105"
                      )}
                      onClick={() => setNewTagColor(c.key)}
                    />
                  ))}
                  <label
                    className="h-5 w-5 rounded-full cursor-pointer relative overflow-hidden ring-1 ring-border/60 hover:ring-foreground/40 hover:scale-105 transition-all"
                    style={{
                      background:
                        "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                    }}
                    title="Cor personalizada"
                  >
                    <input
                      type="color"
                      value={isHexColor(newTagColor) ? newTagColor : "#7c5cff"}
                      onChange={(e) => setNewTagColor(e.target.value.toLowerCase())}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={!newTagName.trim() || createTagMut.isPending}
              onClick={handleCreateTag}
            >
              <Plus className="h-3.5 w-3.5" />
              Criar
            </Button>
          </div>

          {/* Existing tags list */}
          {globalTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Etiquetas existentes</p>
              <div className="flex flex-wrap gap-2">
                {globalTags.map(gt => {
                  const rawTag = `${gt.name}:${gt.color_key}`;
                  const tc = tagColor(rawTag);
                  return (
                    <div
                      key={gt.id}
                      className={cn("flex items-center gap-1.5 rounded-full pl-2.5 pr-1 py-1", tc.bg)}
                      style={tc.style}
                    >
                      <span className={cn("text-xs font-medium", tc.text)} style={tc.style ? { color: tc.hex } : undefined}>
                        {gt.name}
                      </span>
                      <button
                        className="h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/30 transition-all"
                        onClick={() => deleteTagWithScoring.mutate({ id: gt.id, name: gt.name, color_key: gt.color_key })}
                        title="Remover etiqueta"
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tag scoring table */}
          {!configQ.isLoading && tagRows.length > 0 && (
            <>
              <div className="rounded-lg border border-border/60 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etiqueta</TableHead>
                      <TableHead className="text-center w-[100px]">Pontos base</TableHead>
                      <TableHead className="text-center w-[100px]">Penalidade atraso</TableHead>
                      <TableHead className="text-center w-[120px]">Multiplicador extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagRows.map((row) => {
                      const matchedTag = globalTags.find((gt) => normalizePmTagStageKey(gt.name) === row.stage);
                      const rawTag = matchedTag ? `${matchedTag.name}:${matchedTag.color_key}` : null;
                      const tc = rawTag ? tagColor(rawTag) : null;
                      return (
                      <TableRow key={row.id}>
                        <TableCell>
                          {tc ? (
                            <Badge className={cn("text-xs h-6 px-2.5 gap-1 border-0", tc.bg, tc.text)}>
                              {getVal(row, "label")}
                            </Badge>
                          ) : (
                            <span className="font-medium">{getVal(row, "label")}</span>
                          )}
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
                          <Input
                            type="number"
                            step="0.1"
                            className="w-20 mx-auto text-center h-8 tabular-nums"
                            value={getVal(row, "extra_demand_multiplier")}
                            onChange={(e) => setVal(row, "extra_demand_multiplier", Number(e.target.value))}
                          />
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
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
