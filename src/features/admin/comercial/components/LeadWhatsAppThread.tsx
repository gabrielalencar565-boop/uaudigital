import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "../crm-constants";
import type { CrmLead } from "../hooks/use-crm-leads";

interface Props { lead: CrmLead }

export function LeadWhatsAppThread({ lead }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    enabled: !!lead.phone_key,
    queryKey: ["crm-wa-messages", lead.phone_key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, contact_phone, direction, body, media_type, media_url, created_at")
        .eq("contact_phone_key", lead.phone_key!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!lead.phone_key) return;
    const ch = supabase
      .channel(`crm-wa-${lead.phone_key}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `contact_phone_key=eq.${lead.phone_key}` },
        () => qc.invalidateQueries({ queryKey: ["crm-wa-messages", lead.phone_key] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lead.phone_key, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.data?.length]);

  if (!lead.telefone) {
    return <div className="text-center text-sm text-muted-foreground py-10">Lead sem telefone cadastrado.</div>;
  }

  const send = async () => {
    const msg = draft.trim();
    if (!msg) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
        body: { action: "send", phone: lead.telefone, type: "manual", message: msg },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error("Falha no envio");
      setDraft("");
      toast.success("Mensagem enviada");
      qc.invalidateQueries({ queryKey: ["crm-wa-messages", lead.phone_key] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[480px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 rounded-lg border border-border/40 p-3 bg-muted/20">
        {messages.isLoading && <div className="text-xs text-muted-foreground text-center py-6">Carregando...</div>}
        {messages.data?.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sem mensagens ainda</div>}
        {messages.data?.map((m: any) => (
          <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-card border border-border/50",
              )}
            >
              {m.body ?? <span className="italic text-xs opacity-70">[{m.media_type ?? "anexo"}]</span>}
              <div className={cn("text-[10px] mt-1 opacity-70")}>{fmtDateTime(m.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="resize-none"
        />
        <Button onClick={send} disabled={sending || !draft.trim()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
