import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

interface ConversationUnread {
  conversation_id: string;
  type: "general" | "direct";
  unread_count: number;
  last_message_at: string | null;
  other_user_id: string | null;
}

export function useChatUnread() {
  const { user } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat_unread_global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", "unread"] });
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_participants", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["chat", "unread"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  return useQuery({
    queryKey: ["chat", "unread", user?.id],
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async (): Promise<ConversationUnread[]> => {
      if (!user) return [];
      // Get participants for current user (with last_read_at)
      const { data: parts, error: e1 } = await supabase
        .from("chat_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);
      if (e1) throw e1;
      const partList = parts ?? [];
      if (partList.length === 0) return [];
      const convIds = partList.map((p) => p.conversation_id);

      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id, type, updated_at")
        .in("id", convIds);

      // Fetch latest messages per conversation (limit fetch)
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, sender_id, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false })
        .limit(500);

      // Other participants for direct convs
      const { data: others } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .neq("user_id", user.id);

      const lastReadMap = new Map(partList.map((p) => [p.conversation_id, p.last_read_at]));
      const otherMap = new Map<string, string>();
      (others ?? []).forEach((o: any) => otherMap.set(o.conversation_id, o.user_id));

      const result: ConversationUnread[] = (convs ?? []).map((c: any) => {
        const lastRead = lastReadMap.get(c.id);
        const convMsgs = (msgs ?? []).filter((m: any) => m.conversation_id === c.id);
        const unread = convMsgs.filter(
          (m: any) => m.sender_id !== user.id && (!lastRead || new Date(m.created_at) > new Date(lastRead))
        ).length;
        return {
          conversation_id: c.id,
          type: c.type,
          unread_count: unread,
          last_message_at: convMsgs[0]?.created_at ?? c.updated_at,
          other_user_id: otherMap.get(c.id) ?? null,
        };
      });
      return result.sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
    },
  });
}

export function useTotalUnread() {
  const { data } = useChatUnread();
  return (data ?? []).reduce((sum, c) => sum + c.unread_count, 0);
}
