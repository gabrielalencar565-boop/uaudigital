import { useEffect, useMemo, useState } from "react";
import { Search, Users, Hash } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { ChatThread } from "./components/ChatThread";
import { useTeamMembers } from "./hooks/useTeamMembers";
import { useChatPresence } from "./hooks/useChatPresence";
import { useGeneralConversation } from "./hooks/useGeneralConversation";
import { useChatUnread } from "./hooks/useChatUnread";
import { getOrCreateDirect } from "./chat-api";
import { setActiveConversation, setChatPanelOpen } from "./active-chat-state";

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Offline";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Offline";
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays <= 0) return `Visto por último hoje às ${time}`;
  if (diffDays === 1) return `Visto por último ontem às ${time}`;
  if (diffDays < 7) {
    const dia = d.toLocaleDateString("pt-BR", { weekday: "long" });
    return `Visto ${dia} às ${time}`;
  }
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Visto em ${date}`;
}


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialConversationId?: string | null;
}

export function ChatPanel({ open, onOpenChange, initialConversationId }: Props) {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const generalId = useGeneralConversation();
  const { data: members } = useTeamMembers();
  const { data: presence } = useChatPresence();
  const { data: unread } = useChatUnread();
  const [tab, setTab] = useState<"general" | "direct">("direct");
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeOther, setActiveOther] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const otherMembers = useMemo(
    () => (members ?? []).filter((m) => m.user_id !== user?.id),
    [members, user]
  );

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return otherMembers.filter((m) => !q || m.display_name.toLowerCase().includes(q));
  }, [otherMembers, search]);

  // Map other_user_id -> last_message_at for direct conversations
  const lastMsgByOther = useMemo(() => {
    const m = new Map<string, string>();
    (unread ?? []).forEach((u) => {
      if (u.type === "direct" && u.other_user_id && u.last_message_at) {
        m.set(u.other_user_id, u.last_message_at);
      }
    });
    return m;
  }, [unread]);

  const recentMembers = useMemo(() => {
    return filteredMembers
      .filter((m) => lastMsgByOther.has(m.user_id))
      .sort((a, b) => (lastMsgByOther.get(b.user_id) ?? "").localeCompare(lastMsgByOther.get(a.user_id) ?? ""));
  }, [filteredMembers, lastMsgByOther]);

  const { onlineMembers, offlineMembers } = useMemo(() => {
    const recentIds = new Set(recentMembers.map((m) => m.user_id));
    const online: typeof filteredMembers = [];
    const offline: typeof filteredMembers = [];
    filteredMembers.forEach((m) => {
      if (recentIds.has(m.user_id)) return;
      if (presence?.[m.user_id]?.is_online) online.push(m);
      else offline.push(m);
    });
    const byName = (a: any, b: any) => a.display_name.localeCompare(b.display_name);
    const byLastSeen = (a: any, b: any) =>
      (presence?.[b.user_id]?.last_seen_at ?? "").localeCompare(presence?.[a.user_id]?.last_seen_at ?? "");
    online.sort(byName);
    offline.sort(byLastSeen);
    return { onlineMembers: online, offlineMembers: offline };
  }, [filteredMembers, presence, recentMembers]);

  const unreadByOther = useMemo(() => {
    const m = new Map<string, number>();
    (unread ?? []).forEach((u) => {
      if (u.type === "direct" && u.other_user_id) m.set(u.other_user_id, u.unread_count);
    });
    return m;
  }, [unread]);


  const generalUnread = (unread ?? []).find((u) => u.type === "general")?.unread_count ?? 0;

  const openDirect = async (otherId: string) => {
    setActiveOther(otherId);
    const id = await getOrCreateDirect(otherId);
    if (id) setActiveConv(id);
  };

  const effectiveConv = tab === "general" ? generalId : activeConv;

  // Track active conversation globally so the notifier can suppress
  // sound/toast when the user is already looking at that thread.
  useEffect(() => {
    setChatPanelOpen(open);
    setActiveConversation(open ? effectiveConv : null);
    return () => {
      setActiveConversation(null);
      setChatPanelOpen(false);
    };
  }, [open, effectiveConv]);

  // When opened with an initial conv id (e.g. from a toast click), pick the
  // matching tab/thread.
  useEffect(() => {
    if (!open || !initialConversationId) return;
    if (initialConversationId === generalId) {
      setTab("general");
      return;
    }
    const other = (unread ?? []).find((u) => u.conversation_id === initialConversationId)?.other_user_id;
    setTab("direct");
    setActiveConv(initialConversationId);
    if (other) setActiveOther(other);
  }, [open, initialConversationId, generalId, unread]);

  if (!user) return null;

  const renderMemberRow = (m: any) => {
    const online = !!presence?.[m.user_id]?.is_online;
    const lastSeen = presence?.[m.user_id]?.last_seen_at ?? null;
    const unreadCount = unreadByOther.get(m.user_id) ?? 0;
    const active = activeOther === m.user_id;
    return (
      <button
        key={m.user_id}
        onClick={() => openDirect(m.user_id)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50",
          active && "bg-accent"
        )}
      >
        <div className="relative">
          <Avatar className="h-9 w-9">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {m.display_name.split(" ").slice(0, 2).map((p: string) => p[0]?.toUpperCase() ?? "").join("")}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
              online ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{m.display_name}</span>
            {online && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-500 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                <span className="h-1 w-1 rounded-full bg-white" />
                Online
              </span>
            )}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {online ? m.role_title : formatLastSeen(lastSeen)}
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>
    );
  };



  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex h-full flex-col">
          <div className="border-b border-border/40 px-4 pt-4 pb-2">
            <h2 className="text-lg font-bold mb-3">Chat UAU</h2>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general" className="gap-2">
                <Hash className="h-4 w-4" /> Geral
                {generalUnread > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {generalUnread}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="direct" className="gap-2">
                <Users className="h-4 w-4" /> Privado
                {onlineMembers.length > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500/20 px-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
                    {onlineMembers.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="flex-1 overflow-hidden m-0">
            <ChatThread
              conversationId={effectiveConv}
              currentUserId={user.id}
              isAdmin={isAdmin}
              isGeneral
              headerSlot={
                <div className="border-b border-border/40 px-4 py-2 text-xs text-muted-foreground">
                  Chat geral da empresa • {(members ?? []).length} colaboradores
                </div>
              }
            />
          </TabsContent>

          <TabsContent value="direct" className="flex-1 overflow-hidden m-0 flex">
            <aside className="w-64 border-r border-border/40 flex flex-col">
              <div className="p-2 border-b border-border/40">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar colaborador..."
                    className="pl-7 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {recentMembers.length > 0 && (
                  <>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recentes
                    </div>
                    {recentMembers.map(renderMemberRow)}
                  </>
                )}

                <div className="px-3 pt-3 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Online <span className="text-muted-foreground/60">({onlineMembers.length})</span>
                </div>
                {onlineMembers.length > 0 ? (
                  onlineMembers.map(renderMemberRow)
                ) : (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground/70 italic">Ninguém online no momento</div>
                )}

                <div className="px-3 pt-4 pb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  Offline <span className="text-muted-foreground/60">({offlineMembers.length})</span>
                </div>
                {offlineMembers.map(renderMemberRow)}


                {filteredMembers.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">Nenhum colaborador encontrado</div>
                )}
              </div>
            </aside>
            <div className="flex-1 min-w-0">
              <ChatThread
                conversationId={effectiveConv}
                currentUserId={user.id}
                isAdmin={isAdmin}
                isGeneral={false}
                headerSlot={
                  activeOther ? (
                    <div className="border-b border-border/40 px-4 py-2 flex items-center gap-2 text-sm">
                      {(() => {
                        const m = (members ?? []).find((x) => x.user_id === activeOther);
                        const online = !!presence?.[activeOther]?.is_online;
                        return (
                          <>
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={m?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">{m?.display_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold leading-tight">{m?.display_name}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-green-500" : "bg-muted-foreground/40")} />
                                {online ? "Online" : "Offline"}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : undefined
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
