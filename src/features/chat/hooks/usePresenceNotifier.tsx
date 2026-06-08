import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useTeamMembers } from "./useTeamMembers";

/**
 * Detects when other team members transition from offline → online and
 * shows a toast with their avatar. Clicking the toast opens the direct
 * chat with that user.
 *
 * Skips notifications for the very first snapshot to avoid spamming the
 * user with everyone already-online when the page loads.
 */
export function usePresenceNotifier(onOpenDirect?: (userId: string) => void) {
  const { user } = useSession();
  const { data: members } = useTeamMembers();
  const membersRef = useRef(members);
  membersRef.current = members;

  const onlineRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadSnapshot = async () => {
      const { data } = await supabase
        .from("chat_presence")
        .select("user_id, is_online, last_seen_at");
      if (cancelled || !data) return;
      const cutoff = Date.now() - 60_000;
      const next = new Set<string>();
      data.forEach((row: any) => {
        const ts = new Date(row.last_seen_at).getTime();
        if (row.is_online && ts >= cutoff) next.add(row.user_id);
      });
      onlineRef.current = next;
      seededRef.current = true;
    };

    loadSnapshot();

    const ch = supabase
      .channel("presence_notifier")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_presence" },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          if (!row || row.user_id === user.id) return;
          if (!seededRef.current) return;
          if (document.hidden) return;

          const wasOnline = onlineRef.current.has(row.user_id);
          const ts = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
          const isOnline = !!row.is_online && ts >= Date.now() - 60_000;

          if (isOnline) onlineRef.current.add(row.user_id);
          else onlineRef.current.delete(row.user_id);

          // Notify only on offline → online transitions
          if (!wasOnline && isOnline) {
            const m = (membersRef.current ?? []).find((x) => x.user_id === row.user_id);
            if (!m) return;
            const name = m.display_name ?? "Alguém";
            const avatarUrl = m.avatar_url ?? null;
            const initials = name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p: string) => p[0]?.toUpperCase() ?? "")
              .join("");

            toast.custom(
              (t) => (
                <div
                  onClick={() => {
                    toast.dismiss(t);
                    onOpenDirect?.(row.user_id);
                  }}
                  className="flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-lg border-l-4 border-l-green-500 bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-border/40 hover:bg-accent/50"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/10">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-primary">
                        {initials || "?"}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-popover bg-green-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Está online — toque para conversar
                    </div>
                  </div>
                </div>
              ),
              { duration: 5000, position: "top-right" }
            );
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user, onOpenDirect]);
}
