import { useState, useMemo, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarRange, Clock, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PmTask } from "../../pm-types";
import { useUpdatePmTask } from "../../hooks/use-pm-data";
import { toast } from "sonner";
import type { CronogramaPost } from "./types";
import { PostDetailSidebar } from "./PostDetailSidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

// Status legend for posts
const STATUS_LEGEND = [
{ color: "bg-emerald-500", label: "Aprovado pelo cliente" },
{ color: "bg-blue-500", label: "Aprovado internamente" },
{ color: "bg-amber-500", label: "Alterações (internas)" },
{ color: "bg-red-500", label: "Alterações (cliente)" },
{ color: "bg-primary", label: "Pendente do criador" },
{ color: "bg-muted-foreground/30", label: "Sem posts" }];


function getPostStatusColor(post: CronogramaPost): string {
  const stage = post.stage_current;
  if (stage === "entrega" || stage === "agendamento") return "bg-emerald-500";
  if (stage === "revisao") return "bg-blue-500";
  if (stage === "alteracoes") return "bg-amber-500";
  if (stage === "pdf") return "bg-red-500";
  return "bg-primary";
}

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, {name: string;avatar?: string;}>;
  onTaskClick: (t: PmTask) => void;
  filterClient: string;
}

export function CronogramaClientBrowser({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, filterClient }: Props) {
  const selectedClientId = filterClient;
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedPost, setSelectedPost] = useState<CronogramaPost | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const dragPostId = useRef<string | null>(null);

  const updateTask = useUpdatePmTask();
  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  // Get all unique client IDs that have scheduled posts
  const clientOptions = useMemo(() => {
    const clientIds = new Set<string>();
    tasks.forEach((t) => {
      const children = childTasksMap[t.id] ?? [];
      const hasScheduled = children.some((c) => c.posting_date);
      if (hasScheduled) clientIds.add(t.client_id);
    });
    return Array.from(clientIds).
    map((id) => ({ id, name: clientsMap[id] ?? "—" })).
    sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, childTasksMap, clientsMap]);

  // Fetch attachments for selected client's child tasks
  const filteredParentTasks = useMemo(() => {
    if (selectedClientId === "__all__") return [];
    return tasks.filter((t) => t.client_id === selectedClientId);
  }, [tasks, selectedClientId]);

  const allChildTasks = useMemo(() => {
    return filteredParentTasks.flatMap((t) => childTasksMap[t.id] ?? []);
  }, [filteredParentTasks, childTasksMap]);

  const parentTaskForPublic = useMemo(() => {
    return filteredParentTasks.find((t) => (childTasksMap[t.id] ?? []).some((c) => c.posting_date)) ?? filteredParentTasks[0] ?? null;
  }, [filteredParentTasks, childTasksMap]);

  const selectedClientName = useMemo(() => {
    if (selectedClientId === "__all__") return "";
    return clientsMap[selectedClientId] ?? "Cliente";
  }, [clientsMap, selectedClientId]);

  const childIds = useMemo(() => allChildTasks.map((t) => t.id), [allChildTasks]);

  const attachmentsQ = useQuery({
    queryKey: ["pm_attachments_batch", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data } = await sb.
      from("pm_attachments").
      select("task_id, public_url, file_type, order_index").
      in("task_id", childIds).
      order("order_index", { ascending: true }).
      order("created_at", { ascending: true });
      return (data ?? []) as {task_id: string;public_url: string | null;file_type: string | null;order_index: number;}[];
    }
  });

  // Build scheduled posts
  const scheduledPosts: CronogramaPost[] = useMemo(() => {
    const attachments = attachmentsQ.data ?? [];
    const firstImageMap = new Map<string, string>();
    const allImagesMap = new Map<string, string[]>();
    attachments.forEach((att) => {
      if (att.file_type?.startsWith("image/") && att.public_url) {
        if (!firstImageMap.has(att.task_id)) firstImageMap.set(att.task_id, att.public_url);
        const existing = allImagesMap.get(att.task_id) ?? [];
        existing.push(att.public_url);
        allImagesMap.set(att.task_id, existing);
      }
    });

    return allChildTasks.
    filter((t) => t.posting_date).
    map((t) => ({
      ...t,
      attachment_url: firstImageMap.get(t.id) ?? null,
      all_attachment_urls: allImagesMap.get(t.id) ?? []
    })).
    sort((a, b) => a.posting_date! > b.posting_date! ? 1 : -1);
  }, [allChildTasks, attachmentsQ.data]);

  // Posts by day
  const postsByDay = useMemo(() => {
    const map = new Map<string, CronogramaPost[]>();
    scheduledPosts.forEach((p) => {
      if (!p.posting_date) return;
      map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]);
    });
    return map;
  }, [scheduledPosts]);

  // Calendar days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfMonth(cursor);
    const out: Date[] = [];
    let d = start;
    while (d <= end || out.length % 7 !== 0) {
      out.push(d);
      d = addDays(d, 1);
      if (out.length >= 42) break;
    }
    return out;
  }, [cursor]);

  const resolvedSelected = useMemo(() => {
    if (!selectedPost) return null;
    return scheduledPosts.find((p) => p.id === selectedPost.id) ?? null;
  }, [selectedPost, scheduledPosts]);

  const handleDragStart = useCallback((postId: string) => {
    dragPostId.current = postId;
  }, []);

  const handleDrop = useCallback((dayKey: string) => {
    if (dragPostId.current) {
      updateTask.mutate({ id: dragPostId.current, posting_date: dayKey } as any);
      toast.success("Data atualizada!");
    }
    dragPostId.current = null;
    setDragOverDay(null);
  }, [updateTask]);

  const buildPublicUrl = useCallback(() => {
    if (!parentTaskForPublic || selectedClientId === "__all__") return null;
    const url = new URL(`${window.location.origin}/cronograma/${parentTaskForPublic.id}`);
    url.searchParams.set("client", selectedClientId);
    return url.toString();
  }, [parentTaskForPublic, selectedClientId]);

  const handleShare = async () => {
    const shareUrl = buildPublicUrl();
    if (!shareUrl) {
      toast.error("Selecione um cliente com postagens para compartilhar.");
      return;
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link público aberto e copiado!");
    } catch {
      toast.info(`Link público: ${shareUrl}`);
    }
  };


  const handleUpdatePost = (field: string, value: string | null) => {
    if (!resolvedSelected) return;
    updateTask.mutate({ id: resolvedSelected.id, [field]: value || null } as any);
  };

  const handleRenamePost = (newTitle: string) => {
    if (!resolvedSelected) return;
    updateTask.mutate({ id: resolvedSelected.id, title: newTitle } as any);
    toast.success("Nome atualizado!");
  };

  const goToday = () => setCursor(startOfMonth(new Date()));

  const noClientSelected = selectedClientId === "__all__";

  return (
    <div className="space-y-5">

      {/* Controls bar */}
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.1s" }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor((d) => startOfMonth(subMonths(d, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs rounded-xl h-8 px-3" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor((d) => startOfMonth(addMonths(d, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-bold capitalize ml-2">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
        </div>

        <div className="flex items-center gap-2">

          {!noClientSelected &&
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl h-9" onClick={handleShare}>
              <Link2 className="h-3.5 w-3.5" /> Link público
            </Button>
          }


          {!noClientSelected &&
          <Button
            size="sm"
            className="gap-1.5 text-xs rounded-xl h-9 bg-sidebar text-sidebar-foreground hover:bg-sidebar/90"
            onClick={() => parentTaskForPublic && onTaskClick(parentTaskForPublic)}
            disabled={!parentTaskForPublic}
          >
              <Plus className="h-3.5 w-3.5" /> Novo post
            </Button>
          }
        </div>
      </div>

      {/* Calendar content */}
      <div>
          {noClientSelected ? (
          /* Skeleton placeholder */
          <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.2s" }}>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[0, 1, 2].map((i) =>
              <div key={i} className="rounded-2xl border border-dashed border-border/40 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    {Array.from({ length: i === 0 ? 4 : i === 1 ? 3 : 2 }).map((_, j) =>
                <div key={j} className="rounded-xl border border-dashed border-border/30 p-3 space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                      </div>
                )}
                  </div>
              )}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Selecione um cliente acima para visualizar suas tarefas
              </p>
            </div>) : (

          /* Calendar grid */
          <div className="flex gap-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.2s" }}>
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-3">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) =>
                  <div key={d} className="px-2 py-2 text-xs font-semibold text-center text-primary">{d}</div>
                  )}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const dayPosts = postsByDay.get(key) ?? [];
                    const isToday = isSameDay(day, new Date());
                    const isDragOver = dragOverDay === key;

                    return (
                      <div
                        key={key}
                        className={cn("min-h-24 rounded-xl border p-2 transition-all calendar-card-hover border-[#d9d9d9]",

                        inMonth ? "border-border/20 bg-card/30" : "border-transparent opacity-30",
                        isToday && "border-primary/50 ring-2 ring-primary/15 bg-primary/5",
                        isDragOver && "border-primary ring-2 ring-primary/30 bg-primary/10",
                        dayPosts.length > 0 && "cursor-pointer"
                        )}
                        onClick={() => dayPosts.length > 0 && setSelectedPost(dayPosts[0])}
                        onDragOver={(e) => {e.preventDefault();setDragOverDay(key);}}
                        onDragLeave={() => setDragOverDay(null)}
                        onDrop={(e) => {e.preventDefault();handleDrop(key);}}>
                        
                          <div className={cn(
                          "text-xs font-bold mb-1",
                          isToday ? "text-primary" : "text-muted-foreground/60"
                        )}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {dayPosts.map((post) => {
                            const statusColor = getPostStatusColor(post);
                            return (
                              <div
                                key={post.id}
                                draggable
                                onDragStart={() => handleDragStart(post.id)}
                                className={cn(
                                  "rounded-lg px-1.5 py-1 text-[10px] font-medium truncate cursor-grab active:cursor-grabbing transition-all hover:opacity-80",
                                  statusColor === "bg-primary" ? "bg-primary/15 text-primary" :
                                  statusColor === "bg-emerald-500" ? "bg-emerald-500/15 text-emerald-600" :
                                  statusColor === "bg-blue-500" ? "bg-blue-500/15 text-blue-600" :
                                  statusColor === "bg-amber-500" ? "bg-amber-500/15 text-amber-600" :
                                  "bg-red-500/15 text-red-600",
                                  resolvedSelected?.id === post.id && "ring-1 ring-primary"
                                )}
                                onClick={(e) => {e.stopPropagation();setSelectedPost(post);}}>
                                
                                  {post.posting_time && `${post.posting_time} – `}{post.title}
                                </div>);

                          })}
                          </div>
                        </div>);

                  })}
                  </div>

                  {/* Status legend */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/20 flex-wrap">
                    {STATUS_LEGEND.map((s) =>
                  <div key={s.label} className="flex items-center gap-1.5">
                        <div className={cn("h-2.5 w-2.5 rounded-full border border-background", s.color)} />
                        <span className="text-[10px] text-muted-foreground">{s.label}</span>
                      </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="w-80 shrink-0">
                {resolvedSelected ?
              <PostDetailSidebar
                post={resolvedSelected}
                onClose={() => setSelectedPost(null)}
                onUpdate={handleUpdatePost}
                onRename={handleRenamePost}
                clientName={selectedClientName} /> :


              <div className="rounded-2xl border bg-card/40 backdrop-blur-sm p-6 flex flex-col items-center justify-center min-h-[400px] text-center border-[#d9d9d9]">
                    <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">Selecione um post para visualizar</p>
                  </div>
              }
              </div>
            </div>)
          }
      </div>
    </div>);

}