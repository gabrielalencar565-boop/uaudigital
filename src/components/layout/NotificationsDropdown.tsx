import { useMemo, useCallback } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { Bell, AlertTriangle, AtSign, UserPlus, Clock, Check, CheckCheck, FileText, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { useRole } from "@/hooks/use-role";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { setPendingAppeal } from "@/lib/pending-appeal-store";

type NotificationItem = {
  id: string;
  key: string; // unique key for read tracking
  type: "mention" | "assigned" | "overdue" | "upcoming" | "appeal";
  title: string;
  subtitle: string;
  timestamp: string;
  taskId?: string;
  appealUserId?: string;
};

interface NotificationsDropdownProps {
  onOpenTask?: (taskId: string) => void;
}

export function NotificationsDropdown({ onOpenTask }: NotificationsDropdownProps) {
  const { user } = useSession();
  const today = new Date();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole(user?.id);

  const appealsQ = useQuery({
    queryKey: ["notifications_appeals_admin", user?.id],
    enabled: !!user?.id && isAdmin,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("task_appeals")
        .select("id, task_id, user_id, reason, status, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const appealPmTasksQ = useQuery({
    queryKey: ["notifications_appeals_pm_tasks", (appealsQ.data ?? []).map((a: any) => a.task_id).join(",")],
    enabled: !!appealsQ.data && appealsQ.data.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set((appealsQ.data ?? []).map((a: any) => a.task_id)));
      if (ids.length === 0) return [];
      const { data } = await (supabase as any)
        .from("pm_tasks")
        .select("id, title")
        .in("id", ids);
      return data ?? [];
    },
  });

  const mentionsQ = useQuery({
    queryKey: ["notifications_mentions", user?.id],
    enabled: !!user?.id,
    staleTime: 0, // Always refetch when invalidated by realtime
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pm_comments")
        .select("id, content, task_id, author_id, created_at")
        .ilike("content", `%@${user!.id}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const assignedQ = useQuery({
    queryKey: ["notifications_assigned", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {

      const { data } = await (supabase as any)
        .from("pm_tasks")
        .select("id, title, client_id, due_date, status_global, assignee_id, created_at")
        .eq("assignee_id", user!.id)
        .is("deleted_at", null)
        .not("status_global", "in", "(concluido,cancelado)")
        .not("due_date", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const membersQ = useQuery({
    queryKey: ["team_members_notif"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return (data ?? []).map(tm => ({ ...tm, avatar_url: normalizeAvatarUrl(tm.avatar_url) ?? null }));
    },
  });

  // Fetch read notification keys
  const readsQ = useQuery({
    queryKey: ["notification_reads", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notification_reads")
        .select("notification_key")
        .eq("user_id", user!.id);
      return new Set((data ?? []).map((r: any) => r.notification_key));
    },
  });

  const readKeys = readsQ.data ?? new Set<string>();

  // Fetch dismissed notification keys (used by "Limpar")
  const dismissalsQ = useQuery({
    queryKey: ["notification_dismissals_bell", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notification_dismissals")
        .select("notification_key")
        .eq("user_id", user!.id);
      return new Set<string>((data ?? []).map((r: any) => r.notification_key));
    },
  });
  const dismissedKeys = dismissalsQ.data ?? new Set<string>();

  const markAsRead = useMutation({
    mutationFn: async (key: string) => {
      await (supabase as any)
        .from("notification_reads")
        .upsert({ user_id: user!.id, notification_key: key }, { onConflict: "user_id,notification_key" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification_reads"] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async (keys: string[]) => {
      const rows = keys.map(k => ({ user_id: user!.id, notification_key: k }));
      await (supabase as any)
        .from("notification_reads")
        .upsert(rows, { onConflict: "user_id,notification_key" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification_reads"] }),
  });

  const dismissAll = useMutation({
    mutationFn: async (keys: string[]) => {
      if (keys.length === 0) return;
      const rows = keys.map(k => ({ user_id: user!.id, notification_key: k }));
      await (supabase as any)
        .from("notification_dismissals")
        .upsert(rows, { onConflict: "user_id,notification_key" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification_dismissals_bell"] });
      queryClient.invalidateQueries({ queryKey: ["mentions_dismissals"] });
    },
  });

  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach(tm => {
      m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };
    });
    return m;
  }, [membersQ.data]);

  const formatMentionContent = useCallback((text: string) => {
    return text.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const m = membersMap[id];
      return m ? `@${m.name}` : "@alguém";
    });
  }, [membersMap]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    // Dedupe cloned mentions (same author + content across split subtasks) — keep earliest
    const mentionsSorted = [...(mentionsQ.data ?? [])].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const seenMentions = new Set<string>();
    mentionsSorted.forEach((c: any) => {
      const dedupeKey = `${c.author_id}::${(c.content ?? "").trim()}`;
      if (seenMentions.has(dedupeKey)) return;
      seenMentions.add(dedupeKey);
      const author = membersMap[c.author_id];
      items.push({
        id: `mention-${c.id}`,
        key: `mention-${c.id}`,
        type: "mention",
        title: `${author?.name ?? "Alguém"} te mencionou`,
        subtitle: formatMentionContent(c.content?.substring(0, 80) ?? ""),
        timestamp: c.created_at,
        taskId: c.task_id,
      });
    });

    (assignedQ.data ?? []).forEach((t: any) => {
      if (t.due_date) {
        const daysLeft = differenceInCalendarDays(new Date(t.due_date + "T00:00:00"), today);
        if (daysLeft < 0) {
          const absDays = Math.abs(daysLeft);
          items.push({
            id: `overdue-${t.id}`,
            key: `overdue-${t.id}`,
            type: "overdue",
            title: `Tarefa atrasada: ${t.title}`,
            subtitle: absDays === 1 ? `Venceu ontem` : `Atrasada há ${absDays} dias`,
            timestamp: t.due_date,
            taskId: t.id,
          });
        } else if (daysLeft <= 1) {
          items.push({
            id: `upcoming-${t.id}`,
            key: `upcoming-${t.id}`,
            type: "upcoming",
            title: `Tarefa próxima: ${t.title}`,
            subtitle: daysLeft === 0 ? "Vence hoje" : "Vence amanhã",
            timestamp: t.due_date,
            taskId: t.id,
          });
        }
      }
    });

    if (isAdmin) {
      const titlesById = new Map<string, string>((appealPmTasksQ.data ?? []).map((t: any) => [t.id, t.title]));
      (appealsQ.data ?? []).forEach((a: any) => {
        const requester = membersMap[a.user_id];
        const taskTitle = titlesById.get(a.task_id) ?? "Tarefa";
        items.push({
          id: `appeal-${a.id}`,
          key: `appeal-${a.id}`,
          type: "appeal",
          title: `${requester?.name ?? "Alguém"} pediu análise de atraso`,
          subtitle: `${taskTitle} — ${(a.reason ?? "").substring(0, 80)}`,
          timestamp: a.created_at,
          taskId: a.task_id,
          appealUserId: a.user_id,
        });
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.filter(n => !dismissedKeys.has(n.key)).slice(0, 30);
  }, [mentionsQ.data, assignedQ.data, appealsQ.data, appealPmTasksQ.data, isAdmin, membersMap, today, formatMentionContent, dismissedKeys]);

  const unreadCount = notifications.filter(n => !readKeys.has(n.key)).length;

  const typeIcon = {
    mention: AtSign,
    assigned: UserPlus,
    overdue: AlertTriangle,
    upcoming: Clock,
    appeal: FileText,
  };

  const typeColor = {
    mention: "text-primary",
    assigned: "text-blue-400",
    overdue: "text-destructive",
    upcoming: "text-warning",
    appeal: "text-yellow-500",
  };

  const handleClickNotification = (n: NotificationItem) => {
    if (!readKeys.has(n.key)) {
      markAsRead.mutate(n.key);
    }
    if (n.type === "appeal" && n.taskId && n.appealUserId) {
      // Persist the pending appeal so AdminDeadlineReport picks it up on mount
      setPendingAppeal({ pmTaskId: n.taskId, userId: n.appealUserId });
      window.dispatchEvent(new CustomEvent("open-appeal-review", {
        detail: { pmTaskId: n.taskId, userId: n.appealUserId },
      }));
      return;
    }
    if (n.taskId && onOpenTask) {
      onOpenTask(n.taskId);
    }
  };

  const handleMarkAllRead = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const unreadKeys = notifications.filter(n => !readKeys.has(n.key)).map(n => n.key);
    if (unreadKeys.length > 0) markAllAsRead.mutate(unreadKeys);
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const keys = notifications.map(n => n.key);
    if (keys.length > 0) dismissAll.mutate(keys);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) handleMarkAllRead();
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-accent/50 focus:outline-none">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 rounded-xl p-0">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <h3 className="text-sm font-semibold">Notificações</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar tudo como lido
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
                title="Limpar notificações"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação no momento
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map(n => {
                const Icon = typeIcon[n.type];
                const isUnread = !readKeys.has(n.key);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickNotification(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/30 cursor-pointer",
                      isUnread && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50", typeColor[n.type])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.subtitle}</p>
                    </div>
                    {isUnread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                    {!isUnread && (
                      <Check className="mt-1.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
