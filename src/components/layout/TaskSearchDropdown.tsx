import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, User, Calendar, Search, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TaskSearchDropdownProps {
  onSelectTask: (taskId: string) => void;
}

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

export function TaskSearchDropdown({ onSelectTask }: TaskSearchDropdownProps) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showResults = focused && search.trim().length > 0;

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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
    enabled: focused,
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

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return (tasksQ.data ?? [])
      .filter((t) => {
        const clientName = clientsMap[t.client_id] ?? "";
        return (
          t.title.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q)
        );
      })
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        title: t.title,
        client_name: clientsMap[t.client_id] ?? "—",
        stage_current: t.stage_current,
        status_global: t.status_global,
        due_date: t.due_date,
        assignee_name: t.assignee_id ? (membersMap[t.assignee_id] ?? null) : null,
      }));
  }, [search, tasksQ.data, clientsMap, membersMap]);

  const handleSelect = useCallback(
    (taskId: string) => {
      setFocused(false);
      setSearch("");
      onSelectTask(taskId);
    },
    [onSelectTask]
  );

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="Pesquisar tarefa..."
        className="h-8 w-56 rounded-full border border-border/50 bg-muted/30 pl-9 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
      />
      {search ? (
        <button
          type="button"
          onClick={() => { setSearch(""); inputRef.current?.focus(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      )}

      {/* Results dropdown */}
      {showResults && (
        <div className="fixed mt-1.5 w-[420px] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-xl z-[9999]" style={{ top: containerRef.current ? containerRef.current.getBoundingClientRect().bottom + 4 : 60, left: containerRef.current ? containerRef.current.getBoundingClientRect().left : 0 }}>
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma tarefa encontrada.
            </div>
          ) : (
            <div className="py-1">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </div>
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  className="w-full flex flex-col items-start gap-1 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-sm truncate flex-1 text-foreground">
                      {r.title}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0 shrink-0", STATUS_COLORS[r.status_global] ?? "")}
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
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
