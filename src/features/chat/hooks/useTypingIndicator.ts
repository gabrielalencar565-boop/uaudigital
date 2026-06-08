import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export function useTypingIndicator(conversationId: string | null) {
  const { user } = useSession();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!conversationId || !user) return;
    const ch = supabase.channel(`typing_${conversationId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const uid = payload?.user_id;
      if (!uid || uid === user.id) return;
      setTypingUsers((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
      const existing = timeoutsRef.current.get(uid);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== uid));
        timeoutsRef.current.delete(uid);
      }, 3000);
      timeoutsRef.current.set(uid, t);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
      setTypingUsers([]);
    };
  }, [conversationId, user]);

  const notifyTyping = () => {
    if (!user || !channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
  };

  return { typingUsers, notifyTyping };
}
