import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { playChatSound } from "@/lib/notifications";
import { useTeamMembers } from "./useTeamMembers";
import { getActiveConversation, isChatPanelOpen } from "../active-chat-state";

/**
 * Global subscriber that plays a sound and shows a toast for any incoming
 * chat message addressed to the current user (any conversation they
 * participate in). Should be mounted ONCE, near the top of the tree.
 */
export function useChatNotifier(onOpenConversation?: (conversationId: string) => void) {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const membersRef = useRef(members);
  membersRef.current = members;
  const myConvsRef = useRef<Set<string>>(new Set());

  // Load participating conversations once + subscribe to changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      myConvsRef.current = new Set((data ?? []).map((r: any) => r.conversation_id));
    };
    load();
    const ch = supabase
      .channel("chat_notifier_parts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_participants", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Listen to all message inserts
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat_notifier_msgs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;
          if (!myConvsRef.current.has(msg.conversation_id)) return;

          // Skip notification when the user is already looking at this conv.
          if (isChatPanelOpen() && getActiveConversation() === msg.conversation_id && !document.hidden) {
            return;
          }

          const sender = (membersRef.current ?? []).find((m) => m.user_id === msg.sender_id);
          const senderName = sender?.display_name ?? "Alguém";
          const preview = (msg.content ?? "").toString().slice(0, 80) || "📎 Anexo";

          playNotificationSound();
          toast(senderName, {
            description: preview,
            duration: 6000,
            position: "top-right",
            className: "border-l-4 !border-l-primary",
            action: onOpenConversation
              ? {
                  label: "Abrir",
                  onClick: () => onOpenConversation(msg.conversation_id),
                }
              : undefined,
          });

          qc.invalidateQueries({ queryKey: ["chat", "unread"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc, onOpenConversation]);
}
