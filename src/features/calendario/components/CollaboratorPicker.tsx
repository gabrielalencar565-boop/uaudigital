import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, ExternalLink, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/features/data/queries";
import { useInstagramConnections } from "../hooks/use-instagram";
import { useCollaboratorStatus, useSavePartner, usePartners } from "../hooks/use-collaborators";
import { cn } from "@/lib/utils";

// Instagram collab invites. An invite goes to whoever owns the typed @, so a typo that happens to be a real account invites the
// wrong person and nothing fails. Every @ therefore has to be confirmed once, by looking at the profile on Instagram; confirmed
// profiles (and the agency's own clients) show a seal, the others show "conferir" and block scheduling. Instagram offers no search
// over all accounts (nor who an account follows), so suggestions come from the agency's clients, confirmed partners and past invites.
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
const MAX = 3;

type Suggestion = { username: string; label: string; hint: string; photo: string | null };

const normalize = (raw: string) =>
  raw.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").replace(/\?.*$/, "").toLowerCase();

function Avatar({ photo, label, size = "h-8 w-8" }: { photo: string | null; label: string; size?: string }) {
  return photo ? (
    <img src={photo} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} loading="lazy" />
  ) : (
    <span className={cn(size, "flex shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium uppercase text-muted-foreground")}>
      {label.replace(/^@/, "").slice(0, 2)}
    </span>
  );
}

function ConfirmPopover({ username, photo, status }: { username: string; photo: string | null; status: "client" | "verified" | "pending" }) {
  const save = useSavePartner();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            status === "pending" ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25" : "text-emerald-500 hover:bg-emerald-500/10",
          )}
          title={status === "pending" ? "Conferir este perfil" : "Perfil confirmado"}
        >
          {status === "pending" ? <><AlertTriangle className="h-3 w-3" /> Conferir</> : <BadgeCheck className="h-3.5 w-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="start">
        <div className="flex items-center gap-3">
          <Avatar photo={photo} label={username} size="h-12 w-12" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">@{username}</p>
            <p className="text-[11px] text-muted-foreground">
              {status === "pending" ? "Ainda não conferido" : status === "client" ? "Cliente conectado ao Fluxo" : "Perfil confirmado"}
            </p>
          </div>
        </div>
        {status === "pending" && (
          <p className="text-xs text-muted-foreground">
            O convite vai para quem for dono deste @. Abra o perfil no Instagram e veja se é mesmo a pessoa que você quer convidar.
          </p>
        )}
        <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
          <a href={`https://www.instagram.com/${username}/`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir @{username} no Instagram
          </a>
        </Button>
        {status !== "client" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) save.mutate({ username, photo: file }, { onSuccess: () => toast.success("Foto salva.") });
              }}
            />
            <Button type="button" variant="ghost" size="sm" className="w-full gap-1.5" disabled={save.isPending} onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> {photo ? "Trocar foto do perfil" : "Adicionar foto do perfil (opcional)"}
            </Button>
          </>
        )}
        {status === "pending" && (
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            disabled={save.isPending}
            onClick={() => save.mutate({ username, verify: true }, { onSuccess: () => { toast.success(`@${username} confirmado.`); setOpen(false); } })}
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} Está certo, confirmar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CollaboratorPicker({
  value,
  onChange,
  clientId,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  // the publication's own client: its own @ is never offered (an account can't invite itself)
  clientId?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const clientsQ = useClients();
  const connectionsQ = useInstagramConnections();
  const partnersQ = usePartners();
  const { statusOf, pending } = useCollaboratorStatus(value);
  const pastQ = useQuery({
    queryKey: ["publication_collaborators_used"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("calendar_publications").select("collaborators").is("deleted_at", null).order("updated_at", { ascending: false }).limit(400);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { collaborators: string[] }[]) for (const c of row.collaborators ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    },
  });

  const all = useMemo<Suggestion[]>(() => {
    const byClient = new Map((clientsQ.data ?? []).map((c) => [c.id, c]));
    const list: Suggestion[] = [];
    const seen = new Set<string>();
    for (const conn of connectionsQ.data ?? []) {
      const username = conn.instagram_username?.toLowerCase();
      const client = byClient.get(conn.client_id);
      if (!username || !client || conn.client_id === clientId || seen.has(username)) continue;
      seen.add(username);
      list.push({ username, label: client.name, hint: "Cliente", photo: client.logo_url ?? null });
    }
    for (const p of partnersQ.data ?? []) {
      if (seen.has(p.username)) continue;
      seen.add(p.username);
      list.push({ username: p.username, label: `@${p.username}`, hint: p.verified_at ? "Parceiro confirmado" : "Ainda não conferido", photo: p.photo_url });
    }
    for (const username of pastQ.data ?? []) {
      if (seen.has(username)) continue;
      seen.add(username);
      list.push({ username, label: `@${username}`, hint: "Já convidado antes", photo: null });
    }
    return list;
  }, [clientsQ.data, connectionsQ.data, partnersQ.data, pastQ.data, clientId]);

  const photoOf = (name: string) => all.find((s) => s.username === name)?.photo ?? null;

  const query = normalize(draft);
  const suggestions = useMemo(() => {
    const free = all.filter((s) => !value.includes(s.username));
    const filtered = query ? free.filter((s) => s.username.includes(query) || s.label.toLowerCase().includes(query)) : free;
    return filtered.slice(0, 6);
  }, [all, value, query]);

  // typed in full and not among the suggestions: offer to add it as typed (it will still need to be confirmed)
  const typedIsNew = !!query && USERNAME_RE.test(query) && !value.includes(query) && !suggestions.some((s) => s.username === query);
  const rows: Suggestion[] = typedIsNew ? [...suggestions, { username: query, label: `@${query}`, hint: "Adicionar este @ (precisa ser conferido)", photo: null }] : suggestions;

  const add = (raw: string) => {
    const name = normalize(raw);
    if (!name) return;
    if (!USERNAME_RE.test(name)) {
      toast.error("Esse @ não parece válido. Use só letras, números, ponto e sublinhado.");
      return;
    }
    if (value.includes(name)) { setDraft(""); return; }
    if (value.length >= MAX) {
      toast.error("O Instagram aceita no máximo 3 colaboradores por post.");
      return;
    }
    setDraft("");
    setActive(0);
    onChange([...value, name]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((c) => {
          const status = statusOf(c);
          return (
            <span
              key={c}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 text-xs",
                status === "pending" ? "border-amber-500/50 bg-amber-500/5" : "border-border/50 bg-muted/40",
              )}
            >
              <Avatar photo={photoOf(c)} label={c} />
              @{c}
              <ConfirmPopover username={c} photo={photoOf(c)} status={status} />
              <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remover @${c}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {value.length < MAX && (
          <Input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setActive(0); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0))); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Escape") { setOpen(false); }
              else if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const pick = open && rows[active] && !draft.includes(" ") ? rows[active].username : draft;
                add(pick);
              }
            }}
            placeholder={value.length === 0 ? "@perfil para convidar como colaborador" : "@outro perfil"}
            className="h-8 w-60 text-xs"
            autoComplete="off"
          />
        )}
      </div>

      {open && value.length < MAX && rows.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 bg-popover p-1 shadow-md" role="listbox">
          {rows.map((s, i) => (
            <button
              key={s.username}
              type="button"
              role="option"
              aria-selected={i === active}
              // mouse down (not click) so the input keeps focus and doesn't close the list before the pick lands
              onMouseDown={(e) => { e.preventDefault(); add(s.username); }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", i === active ? "bg-muted" : "hover:bg-muted/60")}
            >
              <Avatar photo={s.photo} label={s.username} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.label.startsWith("@") ? s.label : `@${s.username}`}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{s.label.startsWith("@") ? s.hint : `${s.label} · ${s.hint}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {pending.length > 0 ? (
        <p className="flex items-start gap-1.5 text-[11px] font-medium text-amber-500">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          Confira {pending.map((p) => `@${p}`).join(", ")}: clique em "Conferir", abra o perfil no Instagram e confirme. Enquanto isso, a publicação não pode ser agendada nem publicada.
        </p>
      ) : value.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">O convite vai junto com a publicação. O post só aparece no perfil da pessoa depois que ela aceitar.</p>
      ) : null}
    </div>
  );
}
