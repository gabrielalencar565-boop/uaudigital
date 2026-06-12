import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Send, Copy, Check, RefreshCw, MessagesSquare, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

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

type TeamMember = {
  user_id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
  is_active: boolean;
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
  sent_by_user_id: string | null;
  source_type: string;
  created_at: string;
};

type FilterKey = "all" | "unread" | "colaborador" | "lead" | "grupo";

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
const WEBHOOK_URL = PROJECT_REF
  ? `https://${PROJECT_REF}.functions.supabase.co/whatsapp-webhook`
  : "";

function initials(name: string | null, phone: string) {
  const src = (name?.trim() || phone).replace(/[^\p{L}\p{N}]/gu, "");
  return src.slice(0, 2).toUpperCase() || "?";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatStamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isGroupContact(c: { origin?: string; phone_e164?: string | null; phone_key?: string | null }) {
  if (c.origin === "grupo") return true;
  const p = (c.phone_e164 ?? "").toString();
  const k = (c.phone_key ?? "").toString();
  return p.includes("-") || p.toLowerCase().endsWith("@g.us") || k.includes("-");
}

function phoneKey(phone: string | null | undefined) {
  const raw = (phone ?? "").toString();
  if (raw.includes("-") || raw.toLowerCase().endsWith("@g.us")) {
    return raw.toLowerCase().trim().replace(/@g\.us$/, "");
  }
  const digits = raw.replace(/\D/g, "");
  return digits ? digits.slice(-10) : null;
}

function originLabel(c: Contact) {
  if (isGroupContact(c)) return "Grupo";
  if (c.origin === "colaborador") return "Equipe";
  return "Lead";
}

export function ConversasPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const teamQ = useQuery({
    queryKey: ["wa-team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id,display_name,role_title,avatar_url,is_active")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
    staleTime: 60_000,
  });
  const teamById = useMemo(() => {
    const m = new Map<string, TeamMember>();
    (teamQ.data ?? []).forEach((t) => m.set(t.user_id, t));
    return m;
  }, [teamQ.data]);

  const memberFor = (c: Contact | null) =>
    c?.user_id ? teamById.get(c.user_id) ?? null : null;
  const displayName = (c: Contact) =>
    memberFor(c)?.display_name ?? c.name ?? c.phone_e164;
  const displayAvatar = (c: Contact) =>
    memberFor(c)?.avatar_url ?? c.profile_pic_url ?? null;

  const contactsQ = useQuery({
    queryKey: ["wa-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Contact[];
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

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("wa-central")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Message | undefined;
        qc.invalidateQueries({ queryKey: ["wa-contacts"] });
        const key = row?.contact_phone_key ?? phoneKey(row?.contact_phone);
        if (key) {
          qc.invalidateQueries({ queryKey: ["wa-messages", key] });
        }
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
      if (filter === "colaborador" && (c.origin !== "colaborador" || isGroupContact(c))) return false;
      if (filter === "lead" && (c.origin !== "lead" || isGroupContact(c))) return false;
      if (filter === "grupo" && !isGroupContact(c)) return false;
      if (!q) return true;
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        c.phone_e164.toLowerCase().includes(q) ||
        (c.phone_key ?? "").includes(q)
      );
    });
  }, [contacts, filter, search]);

  const activeContact = useMemo(
    () => contacts.find((c) => (c.phone_key ?? phoneKey(c.phone_e164)) === activeKey) ?? null,
    [contacts, activeKey],
  );

  // Auto-mark as read when opening
  useEffect(() => {
    if (!activeContact || activeContact.unread_count <= 0) return;
    supabase
      .from("whatsapp_contacts")
      .update({ unread_count: 0 })
      .eq("phone_e164", activeContact.phone_e164)
      .then(() => qc.invalidateQueries({ queryKey: ["wa-contacts"] }), () => {});
  }, [activeContact?.phone_e164, activeContact?.unread_count, qc]);

  const totalUnread = contacts.reduce((s, c) => s + (c.unread_count || 0), 0);

  const sendMessage = async () => {
    if (!activeContact || !draft.trim()) return;
    setSending(true);
    const message = draft.trim();
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", {
        body: { action: "send", phone: activeContact.phone_e164, type: "manual", message },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error("Falha no envio");
      setDraft("");
      toast.success("Mensagem enviada");
      qc.invalidateQueries({ queryKey: ["wa-messages", activeKey] });
      qc.invalidateQueries({ queryKey: ["wa-contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async () => {
    if (!activeContact) return;
    await supabase.from("whatsapp_contacts").update({ unread_count: 0 }).eq("phone_e164", activeContact.phone_e164);
    qc.invalidateQueries({ queryKey: ["wa-contacts"] });
  };

  const linkContact = async (userId: string | null) => {
    if (!activeContact) return;
    const { error } = await supabase.rpc("whatsapp_link_contact_to_user" as any, {
      _phone: activeContact.phone_e164,
      _user_id: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(userId ? "Contato vinculado" : "Vínculo removido");
    setLinkOpen(false);
    qc.invalidateQueries({ queryKey: ["wa-contacts"] });
  };

  const copyWebhook = async () => {
    if (!WEBHOOK_URL) return;
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast.success("URL copiada");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessagesSquare className="h-6 w-6 text-primary" /> Conversas
          </h2>
          <p className="text-sm text-muted-foreground">
            Central de atendimento via WhatsApp. {totalUnread > 0 && (
              <span className="font-medium text-foreground">{totalUnread} não lidas</span>
            )}
          </p>
        </div>
        {WEBHOOK_URL && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Webhook Z-API:</span>
            <code className="truncate max-w-[280px]">{WEBHOOK_URL}</code>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={copyWebhook}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 rounded-xl border border-border bg-card overflow-hidden h-[calc(100svh-220px)] min-h-[520px]">
        {/* List */}
        <aside className="border-r border-border flex flex-col min-h-0">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome ou número..."
                className="pl-7 h-8 text-xs"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList className="grid grid-cols-5 h-8">
                <TabsTrigger value="all" className="text-[10px] px-1">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="text-[10px] px-1">Não lidas</TabsTrigger>
                <TabsTrigger value="colaborador" className="text-[10px] px-1">Equipe</TabsTrigger>
                <TabsTrigger value="lead" className="text-[10px] px-1">Leads</TabsTrigger>
                <TabsTrigger value="grupo" className="text-[10px] px-1">Grupos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-y-auto">
            {contactsQ.isLoading ? (
              <div className="p-4 text-xs text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                Nenhuma conversa aqui ainda.
              </div>
            ) : (
              filtered.map((c) => {
                const key = c.phone_key ?? phoneKey(c.phone_e164);
                const active = key === activeKey;
                const member = memberFor(c);
                const name = displayName(c);
                const avatarSrc = displayAvatar(c);
                return (
                  <button
                    key={key ?? c.id}
                    onClick={() => setActiveKey(key)}
                    disabled={!key}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-left border-b border-border/40 hover:bg-accent/50 transition",
                      active && "bg-accent",
                    )}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
                      <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                        {initials(name, c.phone_e164)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {formatTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate flex-1">
                          {c.last_message_preview || "Sem mensagens"}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge
                          variant={isGroupContact(c) ? "default" : member ? "default" : "outline"}
                          className={cn(
                            "text-[9px] py-0 px-1.5 h-4",
                            isGroupContact(c) && "bg-blue-500 hover:bg-blue-500 text-white border-blue-500",
                          )}
                        >
                          {originLabel(c)}
                        </Badge>
                        {member && (
                          <span className="text-[9px] text-muted-foreground truncate">
                            · {member.role_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className="flex flex-col min-h-0">
          {!activeContact ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <header className="border-b border-border px-4 py-3 flex items-center gap-3">
                {(() => {
                  const member = memberFor(activeContact);
                  const name = displayName(activeContact);
                  const avatarSrc = displayAvatar(activeContact);
                  return (
                    <>
                      <Avatar className="h-10 w-10">
                        {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} /> : null}
                        <AvatarFallback className="text-[11px] bg-primary/10 text-primary">
                          {initials(name, activeContact.phone_e164)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold leading-tight truncate flex items-center gap-2">
                          {name}
                          <Badge
                            variant={isGroupContact(activeContact) ? "default" : member ? "default" : "outline"}
                            className={cn(
                              "text-[9px] py-0 px-1.5 h-4",
                              isGroupContact(activeContact) && "bg-blue-500 hover:bg-blue-500 text-white border-blue-500",
                            )}
                          >
                            {originLabel(activeContact)}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                          {isGroupContact(activeContact) ? (
                            <>
                              <span className="font-mono">{activeContact.phone_e164}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(activeContact.phone_e164);
                                  toast.success("ID do grupo copiado");
                                }}
                                className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted/70"
                                title="Copiar ID do grupo"
                              >
                                <Copy className="h-2.5 w-2.5" /> ID
                              </button>
                            </>
                          ) : (
                            <span>+{activeContact.phone_e164}{member ? ` · ${member.role_title}` : ""}</span>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
                <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  {activeContact.user_id ? "Alterar vínculo" : "Vincular contato"}
                </Button>
                <Button variant="outline" size="sm" onClick={markAsRead}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Marcar como lida
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => qc.invalidateQueries({ queryKey: ["wa-messages", activeKey] })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {messagesQ.isLoading ? (
                  <div className="text-xs text-muted-foreground">Carregando mensagens…</div>
                ) : (messagesQ.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center mt-8">
                    Nenhuma mensagem ainda.
                  </div>
                ) : (
                  (messagesQ.data ?? []).map((m) => {
                    const own = m.direction === "out";
                    return (
                      <div key={m.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm",
                            own
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border rounded-bl-sm",
                          )}
                        >
                          {m.body && (
                            <div className="whitespace-pre-wrap text-sm leading-snug">{m.body}</div>
                          )}
                          {m.media_url && (
                            <a
                              href={m.media_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs underline mt-1 break-all"
                            >
                              [{m.media_type ?? "anexo"}] abrir mídia
                            </a>
                          )}
                          <div className={cn(
                            "text-[10px] mt-1 flex items-center gap-1",
                            own ? "text-primary-foreground/70 justify-end" : "text-muted-foreground",
                          )}>
                            <span>{formatStamp(m.created_at)}</span>
                            {own && <span>· {m.status}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border p-3 flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite sua resposta..."
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button onClick={sendMessage} disabled={sending || !draft.trim()} size="icon" className="h-10 w-10 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular contato a um colaborador</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Buscar colaborador..." />
            <CommandList>
              <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
              <CommandGroup heading="Equipe">
                {(teamQ.data ?? []).filter((m) => m.is_active).map((m) => (
                  <CommandItem
                    key={m.user_id}
                    value={`${m.display_name} ${m.role_title}`}
                    onSelect={() => linkContact(m.user_id)}
                    className="gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={m.display_name} /> : null}
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {initials(m.display_name, "")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{m.display_name}</span>
                    <span className="text-[10px] text-muted-foreground">{m.role_title}</span>
                    {activeContact?.user_id === m.user_id && <Check className="h-3 w-3" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="flex sm:justify-between gap-2">
            {activeContact?.user_id && (
              <Button variant="outline" size="sm" onClick={() => linkContact(null)}>
                <X className="h-3.5 w-3.5 mr-1" /> Remover vínculo
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
