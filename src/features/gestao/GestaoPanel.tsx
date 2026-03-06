import { useMemo, useState } from "react";
import { Plus, Search, LayoutGrid, CalendarDays, FolderOpen, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePmTasks, usePmAllChildTasks } from "./hooks/use-pm-data";
import { PmKanbanBoard } from "./components/PmKanbanBoard";
import { PmClientView } from "./components/PmClientView";
import { PmTaskCard } from "./components/PmTaskCard";
import { PmTaskDetailDialog } from "./components/PmTaskDetailDialog";
import { PmCreateTaskDialog } from "./components/PmCreateTaskDialog";
import { PmStageFlowConfig } from "./components/PmStageFlowConfig";
import type { PmTask } from "./pm-types";

export function GestaoPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [view, setView] = useState<"kanban" | "agenda" | "clientes" | "fluxo">("kanban");
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("__all__");
  const [filterAssignee, setFilterAssignee] = useState("__all__");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string | undefined>();

  // Data
  const tasksQ = usePmTasks();
  const tasks = tasksQ.data ?? [];

  const allChildTasksQ = usePmAllChildTasks();
  const childTasksMap = useMemo(() => {
    const map: Record<string, PmTask[]> = {};
    (allChildTasksQ.data ?? []).forEach((t) => {
      const pid = t.parent_task_id!;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    });
    return map;
  }, [allChildTasksQ.data]);

  // Resolve selected task from query data for reactivity
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find(t => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, tasks]);

  // Clients
  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  // Team members
  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    },
  });
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach((tm) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  const filters = { clientId: filterClient === "__all__" ? undefined : filterClient, assigneeId: filterAssignee === "__all__" ? undefined : filterAssignee, search: search || undefined };

  // Agenda view
  const agendaTasks = useMemo(() => {
    let list = tasks;
    if (filterClient && filterClient !== "__all__") list = list.filter((t) => t.client_id === filterClient);
    if (filterAssignee && filterAssignee !== "__all__") list = list.filter((t) => t.assignee_id === filterAssignee);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    const grouped: Record<string, PmTask[]> = {};
    list.forEach((t) => {
      const key = t.due_date ?? "sem_prazo";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === "sem_prazo") return 1;
      if (b === "sem_prazo") return -1;
      return a.localeCompare(b);
    });
  }, [tasks, filterClient, filterAssignee, search]);

  const openCreate = (status?: string) => {
    setCreateDefaultStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestão de Tarefas</h2>
          <p className="text-xs text-muted-foreground">Gerencie projetos e tarefas da agência</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2" size="sm">
          <Plus className="h-4 w-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-3">
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os clientes</SelectItem>
            {(clientsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {membersList.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="bg-card/30 h-8">
          <TabsTrigger value="kanban" className="gap-1.5 text-xs h-7">
            <LayoutGrid className="h-3 w-3" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5 text-xs h-7">
            <CalendarDays className="h-3 w-3" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5 text-xs h-7">
            <FolderOpen className="h-3 w-3" /> Por Cliente
          </TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-1.5 text-xs h-7">
            <Settings2 className="h-3 w-3" /> Fluxo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <PmKanbanBoard
            tasks={tasks}
            childTasksMap={childTasksMap}
            clientsMap={clientsMap}
            membersMap={membersMap}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
            onCreateClick={openCreate}
            filters={filters}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <div className="space-y-4">
            {agendaTasks.map(([date, dateTasks]) => (
              <div key={date}>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {date === "sem_prazo" ? "Sem prazo" : format(new Date(date + "T12:00:00"), "dd/MM/yyyy — EEEE")}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dateTasks.map((task) => {
                    const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
                    return (
                      <PmTaskCard
                        key={task.id}
                        task={task}
                        clientName={clientsMap[task.client_id] ?? "—"}
                        assigneeName={member?.name}
                        assigneeAvatar={member?.avatar}
                        childTasks={childTasksMap[task.id] ?? []}
                        onClick={() => setSelectedTaskId(task.id)}
                        isAdmin={isAdmin}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            {agendaTasks.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <PmClientView
            tasks={tasks}
            childTasksMap={childTasksMap}
            clientsMap={clientsMap}
            membersMap={membersMap}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <PmStageFlowConfig />
        </TabsContent>
      </Tabs>

      {/* Task detail */}
      <PmTaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        clientsMap={clientsMap}
        membersMap={membersMap}
        members={membersList}
        isAdmin={isAdmin}
      />

      {/* Create task dialog */}
      <PmCreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={(clientsQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        members={membersList}
        defaultStatus={createDefaultStatus}
      />
    </div>
  );
}
