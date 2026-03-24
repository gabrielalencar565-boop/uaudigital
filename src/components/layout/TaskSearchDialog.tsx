import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, FileText, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface TaskSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTask: (taskId: string) => void;
}

type SearchResult = {
  id: string;
  title: string;
  client_name: string;
  stage_current: string;
  status_global: string;
  due_date: string | null;
  assignee_name: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  design: "Design",
  copy: "Copy",
  revisao: "Revisão",
  aprovacao: "Aprovação",
  agendamento: "Agendamento",
  captacao: "Captação",
  edicao_videos: "Edição",
  producao: "Produção",
  finalizado: "Finalizado",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  em_andamento: "bg-primary/15 text-primary",
  concluido: "bg-emerald-500/15 text-emerald-600",
  cancelado: "bg-destructive/15 text-destructive",
};

export function TaskSearchDialog({ open, onOpenChange, onSelectTask }: TaskSearchDialogProps) {
  const [search, setSearch] = useState("");

  // Fetch clients for name mapping
  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Fetch team members for assignee names
  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, display_name")
        .eq("is_active", true);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Fetch pm_tasks (parent tasks only)
  const tasksQ = useQuery({
    queryKey: ["pm_tasks_search"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pm_tasks")
        .select("id, title, client_id, stage_current, status_global, due_date, assignee_id")
        .is("parent_task_id", null)
        .neq("status_global", "cancelado")
        .order("updated_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    staleTime: 30_000,
    enabled: open,
  });

  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  const membersMap = useMemo(() => {
    const m: Record<string, string> = {};
    (membersQ.data ?? []).forEach((tm) => { m[tm.user_id] = tm.display_name; });
    return m;
  }, [membersQ.data]);

  const results: SearchResult[] = useMemo(() => {
    return (tasksQ.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      client_name: clientsMap[t.client_id] ?? "—",
      stage_current: t.stage_current,
      status_global: t.status_global,
      due_date: t.due_date,
      assignee_name: t.assignee_id ? (membersMap[t.assignee_id] ?? null) : null,
    }));
  }, [tasksQ.data, clientsMap, membersMap]);

  // Filter results based on search query
  const filtered = useMemo(() => {
    if (!search.trim()) return results.slice(0, 20);
    const q = search.toLowerCase().trim();
    return results
      .filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.client_name.toLowerCase().includes(q) ||
          (r.assignee_name && r.assignee_name.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [results, search]);

  // Reset search on close
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const handleSelect = useCallback(
    (taskId: string) => {
      onOpenChange(false);
      onSelectTask(taskId);
    },
    [onOpenChange, onSelectTask]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar tarefa por nome ou cliente..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nenhuma tarefa encontrada.</CommandEmpty>
        <CommandGroup heading={`Tarefas${search.trim() ? ` — "${search}"` : ""}`}>
          {filtered.map((r) => (
            <CommandItem
              key={r.id}
              value={`${r.title} ${r.client_name}`}
              onSelect={() => handleSelect(r.id)}
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="font-medium text-sm truncate flex-1">{r.title}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[r.status_global] ?? ""}`}
                >
                  {STAGE_LABELS[r.stage_current] ?? r.stage_current}
                </Badge>
              </div>
              <div className="flex items-center gap-3 pl-6 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {r.client_name}
                </span>
                {r.due_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(r.due_date + "T12:00:00"), "dd MMM", { locale: ptBR })}
                  </span>
                )}
                {r.assignee_name && (
                  <span className="opacity-70">{r.assignee_name}</span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
