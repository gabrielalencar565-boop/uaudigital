import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setPendingCalendarioFocus } from "@/lib/pending-calendario-focus-store";

// Shared by every place a task detail dialog can be opened (global search, Agenda,
// Meu Painel, Visão do Dia, Relatório de prazos...): jumps straight to that task's
// publication in the Cronograma, switching tabs first if needed. Mirrors the
// "open-appeal-review" event used for the deadline report.
export async function openTaskInCalendario(taskId: string) {
  const sb = supabase as any;
  const { data: pub } = await sb
    .from("calendar_publications")
    .select("id, publication_calendars(client_id, cycle_start)")
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  const cal = pub?.publication_calendars;
  if (!pub || !cal) {
    toast.error("Essa publicação não foi encontrada no Cronograma.");
    return;
  }
  setPendingCalendarioFocus({ clientId: cal.client_id, cycleStart: cal.cycle_start, publicationId: pub.id });
  window.dispatchEvent(new Event("open-calendario-publicacao"));
}
