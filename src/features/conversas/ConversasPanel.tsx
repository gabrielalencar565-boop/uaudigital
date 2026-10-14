import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, MessagesSquare, Send, Trash2 } from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Conversas do CRM: só leads. Mensagens da equipe e de grupos não aparecem aqui.

type Contact = {
  id: string;
  phone_e164: string;
  phone_key: string | null;
  name: string | null;
  origin: "colaborador" | "lead" | "cliente" | "desconhecido" | "grupo";
  status: string;
  user_id: string | null;
  profile_pic_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  contact_phone: string;
  contact_phone_key: string | null;
  direction: "in" | "out";
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string;
  created_at: string;
};

type FilterKey = "all" | "unread";

function initials(name: string | null, phone: string) {
  const src = (name?.trim() || phone).replace(/[^\p{L}\p{N}]/gu, "");
  return src.slice(0, 2).toUpperCase() || "?";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatStamp(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Número de grupo do WhatsApp (não é conversa com lead). */
function isGroupContact(c: { origin?: string; phone_e164?: string | null; phone_key?: string | null }) {
  if (c.origin === "grupo") return true;
  const p = (c.phone_e164 ?? "").toString().toLowerCase();
  const k = (c.phone_key ?? "").toString().toLowerCase();
  return p.endsWith("-group") || k.endsWith("-group") || p.endsWith("@g.us") || p.includes("-") || k.includes("-");
}

function phoneKey(phone: string | null | undefined) {
  const raw = (phone ?? "").toString().toLowerCase().trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-10);
}

interface ConversasPanelProps {
  /** WhatsApp conectado: libera o campo de resposta */
  connected?: boolean;
  onConnect?: () => void;
  /** envia a resposta; rejeita com a mensagem de erro (ex.: fora das 24h) */
  onSend?: (phone: string, text: string) => Promise<unknown>;
}

export function ConversasPanel({ connected = false, onConnect, onSend }: ConversasPanelProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const contactsQ = useQuery({
    queryKey: ["wa-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .neq("origin", "colaborador")
        .neq("origin", "grupo")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as Contact[]).filter((c) => !isGroupContact(c));
    },
    staleTime: 10_000,
  });

  const messagesQ = useQuery({
    queryKey: ["wa-messages", activeKey],
    enabled: !!activeKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("contact_phone_key", activeKey!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("wa-central")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Message | undefined;
        qc.invalidateQueries({ queryKey: ["wa-contacts"] });
        const key = row?.contact_phone_key ?? phoneKey(row?.contact_phone);
        if (key) qc.invalidateQueries({ queryKey: ["wa-messages", key] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-contacts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const contacts = contactsQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter === "unread" && c.unread_count <= 0) return false;
      if (!q) return true;
      return (c.name ?? "").toLowerCase().includes(q) || c.phone_e164.toLowerCase().includes(q) || (c.phone_key ?? "").includes(q);
    });
  }, [contacts, filter, search]);

  const activeContact = useMemo(
    () => contacts.find((c) => (c.phone_key ?? phoneKey(c.phone_e164)) === activeKey) ?? null,
    [contacts, activeKey],
  );

  // abrir a conversa marca como lida
  useEffect(() => {
    if (!activeContact || activeContact.unread_count <= 0) return;
    supabase
      .from("whatsapp_contacts")
      .update({ unread_count: 0 })
      .eq("phone_e164", activeContact.phone_e164)
      .then(() => qc.invalidateQueries({ queryKey: ["wa-contacts"] }), () => {});
  }, [activeContact?.phone_e164, activeContact?.unread_count, qc]);

  const totalUnread = contacts.reduce((s, c) => s + (c.unread_count || 0), 0);

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("whatsapp_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Mensagem apagada");
    qc.invalidateQueries({ queryKey: ["wa-messages", activeKey] });
    qc.invalidateQueries({ queryKey: ["wa-contacts"] });
  };

  const deleteContact = async (c: Contact) => {
    const key = c.phone_key ?? phoneKey(c.phone_e164);
    if (key) await supabase.from("whatsapp_messages").delete().eq("contact_phone_key", key);
    const { error } = await supabase.from("whatsapp_contacts").delete().eq("phone_e164", c.phone_e164);
    if (error) { toast.error(error.message); return; }
    if (activeKey === key) setActiveKey(null);
    toast.success("Conversa apagada");
    qc.invalidateQueries({ queryKey: ["wa-contacts"] });
    if (key) qc.invalidateQueries({ queryKey: ["wa-messages", key] });
  };

  const send = async () => {
    const text = draft.trim();
    if (!activeContact || !text || !onSend || sending) return;
    setSending(true);
    try {
      await onSend(activeContact.phone_e164, text);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["wa-messages", activeKey] });
      qc.invalidateQueries({ queryKey: ["wa-contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  const trashButton = (title: string) => (
    <button type="button" className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-muted-foreground hover:text-destructive p-1 rounded shrink-0" title={title}>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-primary" /> Conversas
          </h2>
          <p className="text-xs text-muted-foreground">
            Mensagens dos leads pelo WhatsApp. {totalUnread > 0 && <span className="font-medium text-foreground">{totalUnread} não lidas</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 rounded-xl border border-border bg-card overflow-hidden h-[calc(100svh-260px)] min-h-[480px]">
        <aside className="border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome ou número..." className="pl-7 h-8 text-xs" />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList className="grid grid-cols-2 h-8">
                <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">Não lidas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contactsQ.isLoading ? (
              <div className="p-4 text-xs text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-xs text-muted-foreground text-center">
                {contacts.length === 0 ? (
                  <div className="space-y-3">
                    <p>{connected ? "Nenhuma conversa ainda. Quando um lead chamar no WhatsApp, ele aparece aqui e no funil." : "Nenhuma conversa ainda. Conecte o WhatsApp para receber as mensagens dos leads aqui."}</p>
                    {!connected && onConnect && <Button size="sm" onClick={onConnect}>Conectar WhatsApp</Button>}
                  </div>
                ) : "Nenhuma conversa nesse filtro."}
              </div>
            ) : (
              filtered.map((c) => {
                const key = c.phone_key ?? phoneKey(c.phone_e164);
                const name = c.name ?? c.phone_e164;
                return (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => key && setActiveKey(key)}
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && key) { e.preventDefault(); setActiveKey(key); } }}
                    className={cn(
                      "group relative w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-border/40 hover:bg-accent/50 transition cursor-pointer",
                      key === activeKey && "bg-accent",
                      !key && "opacity-60 cursor-not-allowed",
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {c.profile_pic_url ? <AvatarImage src={c.profile_pic_url} alt={name} /> : null}
                      <AvatarFallback className="text-[11px] bg-primary/10 text-primary">{initials(name, c.phone_e164)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{formatTime(c.last_message_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate flex-1">{c.last_message_preview || "Sem mensagens"}</span>
                        {c.unread_count > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{c.unread_count}</span>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>{trashButton("Apagar conversa")}</AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
                          <AlertDialogDescription>Remove o contato {name} e todo o histórico de mensagens. Não é possível desfazer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteContact(c)}>Apagar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          {!activeContact ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Selecione uma conversa</div>
          ) : (
            <>
              <header className="border-b border-border px-4 py-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {activeContact.profile_pic_url ? <AvatarImage src={activeContact.profile_pic_url} alt={activeContact.name ?? ""} /> : null}
                  <AvatarFallback className="text-[11px] bg-primary/10 text-primary">{initials(activeContact.name, activeContact.phone_e164)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight truncate">{activeContact.name ?? activeContact.phone_e164}</div>
                  <div className="text-[11px] text-muted-foreground truncate">+{activeContact.phone_e164}</div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Atualizar" onClick={() => qc.invalidateQueries({ queryKey: ["wa-messages", activeKey] })}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {messagesQ.isLoading ? (
                  <div className="text-xs text-muted-foreground">Carregando mensagens…</div>
                ) : (messagesQ.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center mt-8">Nenhuma mensagem ainda.</div>
                ) : (
                  (messagesQ.data ?? []).map((m) => {
                    const own = m.direction === "out";
                    const del = (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>{trashButton("Apagar mensagem")}</AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação remove a mensagem do histórico permanentemente. Não é possível desfazer.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMessage(m.id)}>Apagar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    );
                    return (
                      <div key={m.id} className={cn("group flex items-center gap-1.5", own ? "justify-end" : "justify-start")}>
                        {own && del}
                        <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 shadow-sm", own ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm")}>
                          {m.body && <div className="whitespace-pre-wrap text-sm leading-snug">{m.body}</div>}
                          {m.media_url && (
                            <a href={m.media_url} target="_blank" rel="noreferrer" className="block text-xs underline mt-1 break-all">[{m.media_type ?? "anexo"}] abrir mídia</a>
                          )}
                          <div className={cn("text-[10px] mt-1 flex items-center gap-1", own ? "text-primary-foreground/70 justify-end" : "text-muted-foreground")}>
                            <span>{formatStamp(m.created_at)}</span>
                            {own && <span>· {m.status}</span>}
                          </div>
                        </div>
                        {!own && del}
                      </div>
                    );
                  })
                )}
              </div>

              {connected && onSend ? (
                <div className="border-t border-border p-3 flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder="Escreva a resposta… (Enter envia, Shift+Enter quebra a linha)"
                    className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <Button onClick={() => void send()} disabled={sending || !draft.trim()} className="gap-1.5"><Send className="h-4 w-4" /> Enviar</Button>
                </div>
              ) : (
                <div className="border-t border-border p-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  WhatsApp não conectado: só dá para ler o histórico.
                  {onConnect && <Button size="sm" variant="outline" onClick={onConnect}>Conectar WhatsApp</Button>}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
