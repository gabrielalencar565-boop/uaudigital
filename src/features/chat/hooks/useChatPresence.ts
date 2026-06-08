import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

interface PresenceRow {
  user_id: string;
  last_seen_at: string;
  is_online: boolean;
}

export function useChatPresence() {
  const { user } = useSession();
  const qc = useQueryClient();

  // Heartbeat
  useEffect(() => {
    if (!user) return;
    const ping = async (online = true) => {
      await supabase
        .from("chat_presence")
        .upsert(
          { user_id: user.id, is_online: online, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .then(() => {}, () => {});
    };
    ping(!document.hidden);
    const interval = setInterval(() => ping(!document.hidden), 30_000);
    const onVisibility = () => ping(!document.hidden);
    const onUnload = () => {
      navigator.sendBeacon?.(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/rest/v1/chat_presence?user_id=eq.${user.id}`,
        new Blob([JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() })], { type: "application/json" })
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [user]);


  // Subscribe to presence updates
  useEffect(() => {
    const channel = supabase
      .channel("chat_presence_all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_presence" },
        () => qc.invalidateQueries({ queryKey: ["chat", "presence"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["chat", "presence"],
    staleTime: 15_000,
    queryFn: async (): Promise<Record<string, PresenceRow>> => {
      const { data, error } = await supabase.from("chat_presence").select("user_id, last_seen_at, is_online");
      if (error) throw error;
      const cutoff = Date.now() - 60_000;
      const map: Record<string, PresenceRow> = {};
      (data ?? []).forEach((row: any) => {
        const ts = new Date(row.last_seen_at).getTime();
        map[row.user_id] = {
          ...row,
          is_online: row.is_online && ts >= cutoff,
        };
      });
      return map;
    },
  });
}

export function isUserOnline(presence: Record<string, PresenceRow> | undefined, userId: string) {
  return !!presence?.[userId]?.is_online;
}
