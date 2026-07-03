import { useMemo, useState } from "react";
import { Search, Users, Circle } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useTeamMembers, type TeamMemberLite } from "./hooks/useTeamMembers";
import { useChatPresence } from "./hooks/useChatPresence";

type StatusKey = "online" | "offline";

const STATUS_META: Record<StatusKey, { label: string; dot: string; ring: string; text: string; bg: string }> = {
  online: {
    label: "Online",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  offline: {
    label: "Offline",
    dot: "bg-muted-foreground/50",
    ring: "ring-muted-foreground/20",
    text: "text-muted-foreground",
    bg: "bg-muted/50",
  },
};

function computeStatus(is_online: boolean | undefined): StatusKey {
  return is_online ? "online" : "offline";
}

function formatLastSeen(iso: string | null | undefined) {
  if (!iso) return "sem registro";
  const now = new Date();
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((nowDate.getTime() - dDate.getTime()) / 86_400_000);
  if (diffDays === 0) return `visto hoje às ${time}`;
  if (diffDays === 1) return `visto ontem às ${time}`;
  const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `visto em ${dateStr} às ${time}`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TeamStatusPanel({ open, onOpenChange }: Props) {
  const { user } = useSession();
  const { data: members } = useTeamMembers();
  const { data: presence } = useChatPresence();
  const [search, setSearch] = useState("");

  const otherMembers = useMemo(
    () => (members ?? []).filter((m) => m.user_id !== user?.id),
    [members, user],
  );

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = otherMembers.filter((m) => !q || m.display_name.toLowerCase().includes(q));
    const online: TeamMemberLite[] = [];
    const offline: TeamMemberLite[] = [];
    filtered.forEach((m) => {
      const p = presence?.[m.user_id];
      const s = computeStatus(p?.is_online);
      if (s === "online") online.push(m);
      else offline.push(m);
    });
    const byName = (a: TeamMemberLite, b: TeamMemberLite) => a.display_name.localeCompare(b.display_name);
    online.sort(byName);
    offline.sort((a, b) => {
      const la = presence?.[a.user_id]?.last_seen_at;
      const lb = presence?.[b.user_id]?.last_seen_at;
      if (la && lb) return new Date(lb).getTime() - new Date(la).getTime();
      if (la) return -1;
      if (lb) return 1;
      return byName(a, b);
    });
    return { online, offline, total: filtered.length };
  }, [otherMembers, presence, search]);

  if (!user) return null;

  const renderMember = (m: TeamMemberLite) => {
    const p = presence?.[m.user_id];
    const status = computeStatus(p?.is_online);
    const meta = STATUS_META[status];
    return (
      <div
        key={m.user_id}
        className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 transition hover:border-border hover:bg-card"
      >
        <div className="relative shrink-0">
          <Avatar className={cn("h-11 w-11 ring-2", meta.ring)}>
            <AvatarImage src={m.avatar_url ?? undefined} alt={m.display_name} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initialsOf(m.display_name) || "?"}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
              meta.dot,
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{m.display_name}</span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                meta.bg,
                meta.text,
              )}
            >
              <Circle className={cn("h-1.5 w-1.5 fill-current stroke-none")} />
              {meta.label}
            </span>
          </div>
          {m.role_title && (
            <div className="truncate text-[11px] text-muted-foreground">{m.role_title}</div>
          )}
          {status !== "online" && (
            <div className="truncate text-[10px] text-muted-foreground/70">
              {formatLastSeen(p?.last_seen_at)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, items, statusKey }: { title: string; items: TeamMemberLite[]; statusKey: StatusKey }) => {
    if (items.length === 0) return null;
    const meta = STATUS_META[statusKey];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          <span className="text-[11px] text-muted-foreground/60">({items.length})</span>
        </div>
        <div className="space-y-1.5">{items.map(renderMember)}</div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <div className="border-b border-border/40 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Status da Equipe</h2>
              <p className="text-[11px] text-muted-foreground">
                {grouped.online.length} online · {grouped.offline.length} offline
              </p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <Section title="Online" items={grouped.online} statusKey="online" />
          <Section title="Offline" items={grouped.offline} statusKey="offline" />
          {grouped.total === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum colaborador encontrado
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
