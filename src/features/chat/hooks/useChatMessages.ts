import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, ChatAttachmentRow, ChatMessageRow } from "../types";

const PAGE_SIZE = 50;

export function useChatMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat", "messages", conversationId],
    enabled: !!conversationId,
    staleTime: 10_000,
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];
      const { data: msgs, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const messages = (msgs ?? []) as ChatMessageRow[];
      if (messages.length === 0) return [];
      const ids = messages.map((m) => m.id);
      const [{ data: atts }, { data: reads }] = await Promise.all([
        supabase.from("chat_message_attachments").select("*").in("message_id", ids),
        supabase.from("chat_message_reads").select("message_id, user_id").in("message_id", ids),
      ]);
      const attByMsg = new Map<string, ChatAttachmentRow[]>();
      (atts ?? []).forEach((a: any) => {
        const arr = attByMsg.get(a.message_id) ?? [];
        arr.push(a);
        attByMsg.set(a.message_id, arr);
      });
      const readsByMsg = new Map<string, string[]>();
      (reads ?? []).forEach((r: any) => {
        const arr = readsByMsg.get(r.message_id) ?? [];
        arr.push(r.user_id);
        readsByMsg.set(r.message_id, arr);
      });
      return messages
        .reverse()
        .map((m) => ({
          ...m,
          attachments: attByMsg.get(m.id) ?? [],
          read_by: readsByMsg.get(m.id) ?? [],
        }));
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`chat_msgs_${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
          qc.invalidateQueries({ queryKey: ["chat", "unread"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_message_reads" },
        (payload: any) => {
          // PR-A: só invalida se a leitura é de uma mensagem da conversa aberta
          const msgId = payload?.new?.message_id ?? payload?.old?.message_id;
          if (!msgId) return;
          const cached = qc.getQueryData<any[]>(["chat", "messages", conversationId]);
          if (cached?.some((m) => m.id === msgId)) {
            qc.invalidateQueries({ queryKey: ["chat", "messages", conversationId] });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}
