import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtSign, MessageSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface MentionsWidgetProps {
  onOpenTask?: (taskId: string) => void;
}

export function MentionsWidget({ onOpenTask }: MentionsWidgetProps) {
  const { user } = useSession();

  const mentionsQ = useQuery({
    queryKey: ["my_mentions", user?.id],
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

  const membersQ = useQuery({
    queryKey: ["team_members_mentions"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    },
  });

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
    (membersQ.data ?? []).forEach((tm: any) => {
      m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };
    });
    return m;
  }, [membersQ.data]);

  const tasksMap = useMemo(() => {
    const m: Record<string, string> = {};
    (tasksQ.data ?? []).forEach((t: any) => { m[t.id] = t.title; });
    return m;
  }, [tasksQ.data]);

  const mentions = mentionsQ.data ?? [];

  // Replace @userId with @Name in content for display
  const formatContent = (content: string) => {
    return content.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const member = membersMap[id];
      return member ? `@${member.name}` : "@alguém";
    });
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
                const author = membersMap[m.author_id];
                const taskTitle = m.task_id ? tasksMap[m.task_id] : null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => m.task_id && onOpenTask?.(m.task_id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-accent/30"
                  >
                    <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                      <AvatarImage src={author?.avatar} />
                      <AvatarFallback className="text-[9px]">
                        {initials(author?.name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[13px] font-medium text-foreground">
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
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {formatContent(m.content)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
