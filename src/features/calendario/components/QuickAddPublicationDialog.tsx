import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCreatePmTask, useUpdatePmTask } from "@/features/gestao/hooks/use-pm-data";
import { useTeamMembers } from "@/features/data/queries";
import { PM_STAGES } from "@/features/gestao/pm-constants";
import { useUnscheduledClientTasks } from "../hooks/use-calendar-data";

const sb = supabase as any;

const STAGE_LABEL: Record<string, string> = Object.fromEntries(PM_STAGES.map((s) => [s.key, s.label]));

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  cycleStart: string;
  /** Date clicked via a specific day's "+" in the grid (yyyy-MM-dd), if any — takes
   * precedence over `cycleStart` as the publish_date seed for both tabs. */
  initialDate?: string | null;
  onCreated: (publicationId: string) => void;
}

// Only asks for the bare minimum (título, or which existing task) needed to get a real
// calendar_publications row to exist. Everything else — tipo de conteúdo, legenda, mídia,
// status — is edited right after in PublicationPreviewPanel itself (the same panel used to
// edit every other publication), so this dialog doesn't duplicate any of those fields.
export function QuickAddPublicationDialog({ open, onClose, clientId, cycleStart, initialDate, onCreated }: Props) {
  const createTask = useCreatePmTask();
  const updateTask = useUpdatePmTask();
  const unscheduledQ = useUnscheduledClientTasks(open ? clientId : null);
  const teamMembersQ = useTeamMembers();
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const member of teamMembersQ.data ?? []) m.set(member.user_id, member.display_name);
    return m;
  }, [teamMembersQ.data]);
  const targetDate = initialDate || cycleStart;

  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredTasks = useMemo(() => {
    const list = unscheduledQ.data ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((t) => t.title.toLowerCase().includes(q));
  }, [unscheduledQ.data, search]);

  const selectedTask = filteredTasks.find((t) => t.id === selectedTaskId) ?? unscheduledQ.data?.find((t) => t.id === selectedTaskId);

  function reset() {
    setTitle("");
    setSearch("");
    setSelectedTaskId(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function afterMutationSuccess(taskId: string) {
    const { data: pub, error } = await sb.from("calendar_publications").select("id").eq("task_id", taskId).maybeSingle();
    if (error || !pub) {
      toast.error("Tarefa criada, mas não achei a publicação no Cronograma — confira manualmente.");
      handleClose();
      return;
    }
    onCreated(pub.id);
    handleClose();
  }

  async function submitNew() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const task = await createTask.mutateAsync({
        client_id: clientId,
        title: title.trim(),
        stage_current: "pdf",
        posting_date: targetDate,
        status_global: "backlog",
        is_extra_demand: true,
      } as any);
      await afterMutationSuccess(task.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar publicação");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExisting() {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await updateTask.mutateAsync({
        id: selectedTask.id,
        stage_current: "pdf",
        // Only seed a posting_date if the task doesn't already have one — steers the
        // trigger to the currently-open cycle instead of its "next month" default,
        // without clobbering a date the task might already carry.
        ...(selectedTask.posting_date ? {} : { posting_date: targetDate }),
      } as any);
      await afterMutationSuccess(selectedTask.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mover tarefa para o Cronograma");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova publicação</DialogTitle>
          <DialogDescription>
            Cria a publicação e já abre pra você preencher tipo, legenda, mídia e data.
            {initialDate && <> Data inicial: <strong className="text-foreground">{format(parseISO(initialDate), "dd/MM/yyyy", { locale: ptBR })}</strong>.</>}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="new">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Criar nova</TabsTrigger>
            <TabsTrigger value="existing">Usar tarefa existente</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Promoção relâmpago"
                onKeyDown={(e) => e.key === "Enter" && submitNew()}
              />
            </div>
            <Button className="w-full" disabled={!title.trim() || submitting} onClick={submitNew}>
              {submitting ? "Criando..." : "Criar e abrir"}
            </Button>
          </TabsContent>

          <TabsContent value="existing" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Buscar tarefa do cliente</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedTaskId(null);
                }}
                placeholder="Digite o título..."
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border/50">
                {unscheduledQ.isLoading && <div className="p-3 text-sm text-muted-foreground">Carregando...</div>}
                {!unscheduledQ.isLoading && filteredTasks.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">Nenhuma tarefa disponível.</div>
                )}
                {filteredTasks.map((t) => {
                  const assigneeName = t.assignee_id ? memberNameById.get(t.assignee_id) : null;
                  const meta = [
                    STAGE_LABEL[t.stage_current] ?? t.stage_current,
                    t.due_date ? format(parseISO(t.due_date), "dd/MM", { locale: ptBR }) : null,
                    assigneeName,
                  ].filter(Boolean);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                        selectedTaskId === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <div className="truncate">{t.title}</div>
                      {meta.length > 0 && <div className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full" disabled={!selectedTask || submitting} onClick={submitExisting}>
              {submitting ? "Movendo..." : "Adicionar e abrir"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
