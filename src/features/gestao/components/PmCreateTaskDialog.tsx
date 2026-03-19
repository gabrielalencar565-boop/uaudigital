import { useState, useMemo, useEffect } from "react";
import { FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { useDefaultFlowWithDates, getFixedAssignee, getFixedWatchers } from "./PmStageFlowConfig";
import { PM_ACTIVE_STAGES } from "../pm-constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  membersMap?: Record<string, { name: string; avatar?: string }>;
  defaultStatus?: string;
  onCreated?: (taskId: string) => void;
}

export function PmCreateTaskDialog({ open, onClose, clients, members, membersMap, defaultStatus, onCreated }: Props) {
  const createTask = useCreatePmTask();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [monthRef, setMonthRef] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState(defaultStatus || "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isExtra, setIsExtra] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setClientId("");
      setStage(defaultStatus || "");
      setSelectedMemberIds([]);
      setIsExtra(false);
      setCustomTitle("");
      setMonthRef(String(new Date().getMonth() + 1).padStart(2, "0"));
    }
  }, [open, defaultStatus]);

  // Auto-assign when stage + client change
  useEffect(() => {
    if (!stage || !clientId) return;
    const fixedAssignee = getFixedAssignee(stageAssignees, stage, clientId);
    const fixedWatchers = getFixedWatchers(stageAssignees, stage, clientId);
    const autoIds: string[] = [];
    if (fixedAssignee) autoIds.push(fixedAssignee);
    fixedWatchers.forEach(w => { if (w && !autoIds.includes(w)) autoIds.push(w); });
    if (autoIds.length > 0) setSelectedMemberIds(autoIds);
  }, [stage, clientId, stageAssignees]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const sortedMembers = useMemo(() =>
    [...members].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [members]
  );

  const handleCreate = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    if (!stage) { toast.error("Selecione uma etapa"); return; }

    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const m = parseInt(monthRef, 10);
    const monthLabel = MONTH_LABELS[m - 1] ?? "";
    const stageLabel = PM_ACTIVE_STAGES.find(s => s.key === stage)?.label ?? stage;

    let title: string;
    if (isExtra) {
      title = customTitle.trim() || `[${client.name}] - ${stageLabel}`;
    } else {
      title = `[${client.name}] - ${stageLabel} - ${monthLabel}`;
    }

    const mainAssignee = selectedMemberIds[0] ?? undefined;
    const watchers = selectedMemberIds.slice(1);

    setSaving(true);
    try {
      const task = await createTask.mutateAsync({
        title,
        client_id: clientId,
        stage_current: stage as any,
        assignee_id: mainAssignee,
        watchers: watchers.length > 0 ? watchers : undefined,
        is_extra_demand: isExtra,
        status_global: "backlog",
      });

      onClose();
      if (task?.id && onCreated) {
        onCreated(task.id);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  // Generate month options (no year shown)
  const monthOptions = MONTH_LABELS.map((label, i) => ({
    val: String(i + 1).padStart(2, "0"),
    label,
  }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Nova Tarefa
        </DialogTitle>

        <div className="space-y-3 pt-2">
          {/* Cliente */}
          <div>
            <Label className="text-xs text-muted-foreground">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9 text-sm mt-1.5">
                <SelectValue placeholder="Selecione um cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa */}
          <div>
            <Label className="text-xs text-muted-foreground">Etapa *</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 text-sm mt-1.5">
                <SelectValue placeholder="Selecione uma etapa..." />
              </SelectTrigger>
              <SelectContent>
                {PM_ACTIVE_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key} className="text-sm">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mês referente */}
          {!isExtra && (
            <div>
              <Label className="text-xs text-muted-foreground">Mês referente</Label>
              <Select value={monthRef} onValueChange={setMonthRef}>
                <SelectTrigger className="h-9 text-sm mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.val} value={o.val} className="text-sm">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Membros */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Membros da tarefa</Label>
            <div className="flex flex-wrap gap-2">
              {sortedMembers.map(m => {
                const selected = selectedMemberIds.includes(m.id);
                const info = membersMap?.[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={info?.avatar ?? undefined} />
                      <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Demanda extra */}
          <div className="flex items-center gap-2">
            <Checkbox id="is_extra_kanban" checked={isExtra} onCheckedChange={(v) => setIsExtra(!!v)} />
            <Label htmlFor="is_extra_kanban" className="text-sm cursor-pointer">Demanda extra</Label>
          </div>

          {isExtra && (
            <div>
              <Label className="text-xs text-muted-foreground">Título personalizado</Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex: [Cliente] - Demanda especial"
                className="mt-1.5"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || createTask.isPending}>
              {saving || createTask.isPending ? "Criando..." : "Criar tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
