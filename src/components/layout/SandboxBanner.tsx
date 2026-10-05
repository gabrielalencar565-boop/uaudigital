import { FlaskConical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Shown only inside the "Laboratório" agency: a reminder that everything here is test data, separate from the real agency.
export function SandboxBanner() {
  const q = useQuery({
    queryKey: ["current_agency"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("agencies").select("id, name, is_sandbox").maybeSingle();
      return (data as { id: string; name: string; is_sandbox: boolean } | null) ?? null;
    },
  });
  if (!q.data?.is_sandbox) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm">
      <FlaskConical className="h-4 w-4 shrink-0 text-cyan-500" />
      <p className="min-w-0">
        <span className="font-semibold">Laboratório</span>
        <span className="text-muted-foreground"> — ambiente de testes. Nada daqui aparece na agência real, nem soma pontos ou envia avisos ao time.</span>
      </p>
    </div>
  );
}
