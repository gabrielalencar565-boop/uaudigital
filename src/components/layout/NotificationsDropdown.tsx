import { useMemo, useState } from "react";
import { Bell, AlertTriangle, AtSign, UserPlus, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type NotificationItem = {
  id: string;
  type: "mention" | "assigned" | "overdue" | "upcoming";
  title: string;
  subtitle: string;
  timestamp: string;
  taskId?: string;
};

interface NotificationsDropdownProps {
  onOpenTask?: (taskId: string) => void;
}

export function NotificationsDropdown({ onOpenTask }: NotificationsDropdownProps) {
  const { user } = useSession();
  const today = new Date();
  const [isRead, setIsRead] = useState(false);

  const mentionsQ = useQuery({
    queryKey: ["notifications_mentions", user?.id],
    enabled: !!user?.id,
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
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pm_tasks")
        .select("id, title, client_id, due_date, status_global, assignee_id, created_at")
        .eq("assignee_id", user!.id)
        .not("status_global", "in", "(concluido,cancelado)")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const membersQ = useQuery({
    queryKey: ["team_members_notif"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    },
  });

  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach(tm => {
      m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };
    });
    return m;
  }, [membersQ.data]);

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    (mentionsQ.data ?? []).forEach((c: any) => {
      const author = membersMap[c.author_id];
      items.push({
        id: `mention-${c.id}`,
        type: "mention",
        title: `${author?.name ?? "Alguém"} te mencionou`,
        subtitle: c.content?.substring(0, 80) ?? "",
        timestamp: c.created_at,
        taskId: c.task_id,
      });
    });

    (assignedQ.data ?? []).forEach((t: any) => {
      if (t.due_date) {
        const daysLeft = differenceInCalendarDays(new Date(t.due_date + "T00:00:00"), today);
        if (daysLeft < 0) {
          items.push({
            id: `overdue-${t.id}`,
            type: "overdue",
            title: `Tarefa atrasada: ${t.title}`,
            subtitle: `Venceu há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) === 1 ? "" : "s"}`,
            timestamp: t.due_date,
            taskId: t.id,
          });
        } else if (daysLeft <= 3) {
          items.push({
            id: `upcoming-${t.id}`,
            type: "upcoming",
            title: `Tarefa próxima: ${t.title}`,
            subtitle: daysLeft === 0 ? "Vence hoje" : `Vence em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`,
            timestamp: t.due_date,
            taskId: t.id,
          });
        }
      }
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 30);
  }, [mentionsQ.data, assignedQ.data, membersMap, today]);

  const typeIcon = {
    mention: AtSign,
    assigned: UserPlus,
    overdue: AlertTriangle,
    upcoming: Clock,
  };

  const typeColor = {
    mention: "text-primary",
    assigned: "text-blue-400",
    overdue: "text-destructive",
    upcoming: "text-warning",
  };

  const handleOpenChange = (open: boolean) => {
    if (open && notifications.length > 0) {
      setIsRead(true);
    }
  };

  const handleClickNotification = (n: NotificationItem) => {
    if (n.taskId && onOpenTask) {
      onOpenTask(n.taskId);
    }
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-accent/50 focus:outline-none">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {notifications.length > 0 && !isRead && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {notifications.length > 99 ? "99+" : notifications.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 rounded-xl p-0">
        <div className="border-b border-border/40 px-4 py-3">
          <h3 className="text-sm font-semibold">Notificações</h3>
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
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClickNotification(n)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/30 cursor-pointer"
                  >
                    <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50", typeColor[n.type])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.subtitle}</p>
                    </div>
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
