import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AtSign, MessageSquare, Check, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarDirectory } from "@/hooks/use-avatar-directory";
import { useSession } from "@/hooks/use-session";

interface MentionsWidgetProps {
  onOpenTask?: (taskId: string) => void;
}

export function MentionsWidget({ onOpenTask }: MentionsWidgetProps) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const mentionsQ = useQuery({
    queryKey: ["my_mentions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pm_comments")
        .select("id, content, task_id, author_id, created_at")
        .ilike("content", `%@${user!.id}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const readsQ = useQuery({
    queryKey: ["mentions_reads", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notification_reads")
        .select("notification_key, read_at")
        .eq("user_id", user!.id)
        .like("notification_key", "mention-%");
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => m.set(r.notification_key, r.read_at));
      return m;
    },
  });

  const dismissalsQ = useQuery({
    queryKey: ["mentions_dismissals", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notification_dismissals")
        .select("notification_key")
        .eq("user_id", user!.id)
        .like("notification_key", "mention-%");
      return new Set<string>((data ?? []).map((r: any) => r.notification_key));
    },
  });

  const markRead = useMutation({
    mutationFn: async (key: string) => {
      await (supabase as any)
        .from("notification_reads")
        .upsert({ user_id: user!.id, notification_key: key, read_at: new Date().toISOString() }, { onConflict: "user_id,notification_key" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentions_reads"] });
      queryClient.invalidateQueries({ queryKey: ["notification_reads"] });
    },
  });

  const dismiss = useMutation({
    mutationFn: async (key: string) => {
      await (supabase as any)
        .from("notification_dismissals")
        .upsert({ user_id: user!.id, notification_key: key }, { onConflict: "user_id,notification_key" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mentions_dismissals"] }),
  });

  const avatarDirectory = useAvatarDirectory({ includeProfiles: false });

  const tasksQ = useQuery({
    queryKey: ["pm_tasks_mentions"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pm_tasks")
        .select("id, title, client_id")
        .limit(500);
      return data ?? [];
    },
  });

  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    avatarDirectory.users.forEach((tm) => {
      m[tm.userId] = { name: tm.displayName, avatar: tm.avatarUrl ?? undefined };
    });
    return m;
  }, [avatarDirectory.users]);

  const tasksMap = useMemo(() => {
    const m: Record<string, string> = {};
    (tasksQ.data ?? []).forEach((t: any) => { m[t.id] = t.title; });
    return m;
  }, [tasksQ.data]);

  const reads = readsQ.data ?? new Map<string, string>();
  const dismissed = dismissalsQ.data ?? new Set<string>();

  const mentions = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return (mentionsQ.data ?? []).filter((m: any) => {
      const key = `mention-${m.id}`;
      if (dismissed.has(key)) return false;
      const readAt = reads.get(key);
      if (readAt && now - new Date(readAt).getTime() > dayMs) return false;
      return true;
    });
  }, [mentionsQ.data, reads, dismissed]);

  const formatContent = (content: string) => {
    return content.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const member = membersMap[id];
      return member ? `@${member.name}` : "@alguém";
    });
  };

  const handleOpen = (m: any) => {
    const key = `mention-${m.id}`;
    if (!reads.has(key)) markRead.mutate(key);
    if (m.task_id) onOpenTask?.(m.task_id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AtSign className="h-4 w-4 text-primary" />
          Menções
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          {mentions.length === 0 ? (
            <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
              Nenhuma menção recente
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {mentions.map((m: any) => {
                const key = `mention-${m.id}`;
                const isRead = reads.has(key);
                const author = membersMap[m.author_id];
                const taskTitle = m.task_id ? tasksMap[m.task_id] : null;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "group relative flex items-start gap-3 px-4 py-3 transition hover:bg-accent/30",
                      !isRead && "bg-primary/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpen(m)}
                      className="flex flex-1 items-start gap-3 text-left min-w-0"
                    >
                      <UserAvatar avatarUrl={author?.avatar} name={author?.name} className="mt-0.5 h-7 w-7 shrink-0" fallbackClassName="text-[9px]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn("text-[13px] font-medium", isRead ? "text-muted-foreground" : "text-foreground")}>
                            {author?.name ?? "Alguém"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(m.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        {taskTitle && (
                          <p className="mt-0.5 truncate text-[11px] text-primary/80">
                            <MessageSquare className="mr-1 inline h-3 w-3" />
                            {taskTitle}
                          </p>
                        )}
                        <p className={cn("mt-0.5 line-clamp-2 text-xs", isRead ? "text-muted-foreground/70" : "text-muted-foreground")}>
                          {formatContent(m.content)}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                      {!isRead && (
                        <button
                          type="button"
                          title="Marcar como lida"
                          onClick={(e) => { e.stopPropagation(); markRead.mutate(key); }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Remover"
                        onClick={(e) => { e.stopPropagation(); dismiss.mutate(key); }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
