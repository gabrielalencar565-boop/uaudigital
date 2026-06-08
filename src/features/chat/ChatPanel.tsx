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

function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return "visto por último há algum tempo";
  const now = new Date();
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((nowDate.getTime() - dDate.getTime()) / 86_400_000);
  if (diffDays === 0) return `visto por último hoje às ${time}`;
  if (diffDays === 1) return `visto por último ontem às ${time}`;
  const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `visto por último ${dateStr} às ${time}`;
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
  const [tab, setTab] = useState<"general" | "direct">("general");
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

  const { onlineMembers, offlineMembers } = useMemo(() => {
    const online: typeof filteredMembers = [];
    const offline: typeof filteredMembers = [];
    filteredMembers.forEach((m) => {
      if (presence?.[m.user_id]?.is_online) online.push(m);
      else offline.push(m);
    });
    const sortFn = (a: any, b: any) => a.display_name.localeCompare(b.display_name);
    online.sort(sortFn);
    offline.sort(sortFn);
    return { onlineMembers: online, offlineMembers: offline };
  }, [filteredMembers, presence]);

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
    const unreadCount = unreadByOther.get(m.user_id) ?? 0;
    const active = activeOther === m.user_id;
    return (
      <button
        key={m.user_id}
        onClick={() => openDirect(m.user_id)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50",
          active && "bg-accent",
          !online && "opacity-70"
        )}
      >
        <div className="relative">
          <Avatar className="h-8 w-8">
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
          <div className="truncate font-medium">{m.display_name}</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {online ? m.role_title : formatLastSeen(presence?.[m.user_id]?.last_seen_at)}
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
              <TabsTrigger value="direct" className="gap-2">
                <Users className="h-4 w-4" /> Privado
                {onlineMembers.length > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500/20 px-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
                    {onlineMembers.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Hash className="h-4 w-4" /> Geral
                {generalUnread > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {generalUnread}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

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
                                {online ? "Online" : formatLastSeen(presence?.[activeOther ?? ""]?.last_seen_at)}
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
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
