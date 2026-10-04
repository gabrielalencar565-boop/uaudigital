import { useEffect, useRef, useState } from "react";
import {
  Check, ChevronDown, Chrome, Copy, Eye, EyeOff, Facebook, Globe, Instagram, KeyRound, Linkedin, Mail, MessageCircle, Music2, Palette, Pencil, Pin, Plus, Trash2, Twitter, X, Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CREDENTIAL_PLATFORMS, revealClientCredential, useClientCredentials, useDeleteClientCredential, useSaveClientCredential,
  type ClientCredential, type CredentialPlatform,
} from "../hooks/use-client-data";

const PLATFORMS: Record<CredentialPlatform, { label: string; icon: typeof KeyRound }> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  youtube: { label: "YouTube", icon: Youtube },
  tiktok: { label: "TikTok", icon: Music2 },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  x: { label: "X (Twitter)", icon: Twitter },
  pinterest: { label: "Pinterest", icon: Pin },
  google: { label: "Google", icon: Chrome },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  email: { label: "E-mail", icon: Mail },
  site: { label: "Site / Hospedagem", icon: Globe },
  canva: { label: "Canva", icon: Palette },
  outro: { label: "Outro", icon: KeyRound },
};

const REVEAL_MS = 20_000;

function CredentialForm({ clientId, credential, onClose }: { clientId: string; credential?: ClientCredential; onClose: () => void }) {
  const save = useSaveClientCredential(clientId);
  const [platform, setPlatform] = useState<CredentialPlatform | null>(credential?.platform ?? null);
  const [label, setLabel] = useState(credential?.label ?? "");
  const [username, setUsername] = useState(credential?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [note, setNote] = useState(credential?.note ?? "");

  const editing = !!credential;
  const valid = !!platform && (platform !== "outro" || label.trim().length > 0) && (username.trim().length > 0 || password.length > 0 || editing);

  return (
    <div className="space-y-4 border-t border-border/30 pt-4">
      <div className="flex flex-wrap gap-1.5">
        {CREDENTIAL_PLATFORMS.map((p) => {
          const meta = PLATFORMS[p];
          const active = platform === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
            </button>
          );
        })}
      </div>

      {platform && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {platform === "outro" && (
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da plataforma" className="h-9 rounded-lg sm:col-span-2" />
          )}
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário, e-mail ou telefone" autoComplete="off" className="h-9 rounded-lg" />
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing && credential?.has_password ? "Senha (deixe em branco para manter)" : "Senha"}
              autoComplete="new-password"
              className="h-9 rounded-lg pr-9"
            />
            <button
              type="button"
              aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (ex.: verificação em 2 etapas no WhatsApp do Dr. João)" className="h-9 rounded-lg sm:col-span-2" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">A senha é guardada criptografada e só aparece quando você pedir.</p>
        <div className="flex shrink-0 gap-1.5">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: credential?.id, platform: platform!, label: platform === "outro" ? label : "", username, note,
                  password: password.length > 0 ? password : editing ? undefined : "",
                },
                { onSuccess: onClose },
              )
            }
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({ c, onEdit, onDelete }: { c: ClientCredential; onEdit: () => void; onDelete: () => void }) {
  const meta = PLATFORMS[c.platform] ?? PLATFORMS.outro;
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"user" | "pw" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const fetchPw = async () => {
    setBusy(true);
    try {
      return await revealClientCredential(c.id);
    } catch {
      toast.error("Não foi possível abrir a senha.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    if (pw !== null) { setPw(null); return; }
    const v = await fetchPw();
    if (v === null) return;
    setPw(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPw(null), REVEAL_MS);
  };
  const flash = (what: "user" | "pw") => { setCopied(what); setTimeout(() => setCopied(null), 1400); };
  const copyUser = () => { if (c.username) { navigator.clipboard.writeText(c.username); flash("user"); } };
  const copyPw = async () => {
    const v = pw ?? (await fetchPw());
    if (v === null) return;
    navigator.clipboard.writeText(v);
    flash("pw");
  };

  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 text-muted-foreground"><meta.icon className="h-4 w-4" /></span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{c.platform === "outro" && c.label ? c.label : meta.label}</p>
        {c.username ? (
          <button type="button" onClick={copyUser} title="Copiar" className="flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <span className="truncate">{c.username}</span>
            {copied === "user" ? <Check className="h-3 w-3 shrink-0 text-emerald-500" /> : <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground/60">Sem usuário</p>
        )}
      </div>

      <div className="order-last col-span-3 min-w-0 pl-11 sm:order-none sm:col-span-1 sm:pl-0">
        {c.has_password ? (
          <div className="flex items-center gap-1">
            <span className={cn("min-w-0 truncate text-sm", pw === null ? "tracking-widest text-muted-foreground" : "font-mono")}>{pw ?? "••••••••"}</span>
            <button type="button" aria-label={pw === null ? "Mostrar senha" : "Ocultar senha"} disabled={busy} onClick={toggle} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
              {pw === null ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button type="button" aria-label="Copiar senha" disabled={busy} onClick={copyPw} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground">
              {copied === "pw" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Sem senha</span>
        )}
        {c.note && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/80">{c.note}</p>}
      </div>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" aria-label="Editar" onClick={onEdit} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Remover" onClick={onDelete} className="rounded-full p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function ClienteAcessos({ clientId }: { clientId: string }) {
  const q = useClientCredentials(clientId);
  const remove = useDeleteClientCredential(clientId);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ClientCredential | null>(null);
  const items = q.data ?? [];

  return (
    <section className="flex flex-col rounded-2xl border border-border/30 p-4 transition-colors hover:border-border/60">
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        {items.length > 0 ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <h4 className="min-w-0 truncate text-sm font-medium">Acessos</h4>
            <span className="text-xs tabular-nums text-muted-foreground">{items.length}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </button>
        ) : (
          <h4 className="min-w-0 flex-1 truncate text-sm font-medium">Acessos</h4>
        )}
        <button
          type="button"
          aria-label={adding ? "Fechar" : "Adicionar acesso"}
          onClick={() => { setAdding((v) => !v); setEditing(null); setExpanded(true); }}
          className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", adding && "bg-muted text-foreground")}
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {items.length > 0 ? (
        expanded && <div className="-mx-2 mt-3 space-y-0.5">
          {items.map((c) =>
            editing === c.id ? (
              <div key={c.id} className="mx-2 rounded-xl bg-muted/30 p-3">
                <CredentialForm clientId={clientId} credential={c} onClose={() => setEditing(null)} />
              </div>
            ) : (
              <CredentialRow key={c.id} c={c} onEdit={() => { setEditing(c.id); setAdding(false); }} onDelete={() => setToDelete(c)} />
            ),
          )}
        </div>
      ) : (
        !adding && (
          <button type="button" onClick={() => { setAdding(true); setExpanded(true); }} className="mt-3 w-fit text-xs text-muted-foreground/70 transition-colors hover:text-foreground">
            {q.isLoading ? "Carregando…" : "Adicionar login e senha"}
          </button>
        )
      )}

      {adding && <div className="mt-4"><CredentialForm clientId={clientId} onClose={() => setAdding(false)} /></div>}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este acesso?</AlertDialogTitle>
            <AlertDialogDescription>O login e a senha guardados aqui serão apagados. A conta do cliente não é afetada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) remove.mutate(toDelete.id); setToDelete(null); }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
