import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export function useGeneralConversation() {
  const { user } = useSession();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase.rpc("chat_ensure_general_member").then(
      ({ data, error }) => {
        if (!active) return;
        if (!error && data) setId(data as string);
      },
      () => {}
    );
    return () => {
      active = false;
    };
  }, [user]);

  return id;
}
