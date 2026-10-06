import { useState } from "react";
import { Check, Copy, Link2, Loader2, Mail, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CargoMultiSelect } from "@/components/CargoMultiSelect";
import {
  inviteErrorMessage, inviteLink, useAgencyInvites, useCreateInvite, useRevokeInvite,
  type CreateInviteResult,
} from "./hooks/use-agency-invites";

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copiado");
  } catch {
    toast.error("Não foi possível copiar. Selecione o link e copie manualmente");
  }
}

function LinkRow({ link, emailed, note }: { link: string; emailed?: boolean; note?: string | null }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {emailed ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
        {emailed
          ? "Convite enviado por e-mail. Você também pode compartilhar o link:"
          : "Compartilhe este link com a pessoa (vale 7 dias, uso único):"}
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => copy(link)}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
        </Button>
      </div>
      {!emailed && note && <p className="text-[11px] text-muted-foreground">E-mail não enviado: {note}</p>}
    </div>
  );
}

// One person at a time: e-mail + access level + cargos → link (and an e-mail when it can be delivered).
export function InviteForm({ onCreated }: { onCreated?: () => void }) {
  const create = useCreateInvite();
  const [email, setEmail] = useState("");
  const [admin, setAdmin] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);
  const [result, setResult] = useState<CreateInviteResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await create.mutateAsync({ email, admin, roleTitles: titles });
      setResult(r);
      onCreated?.();
    } catch (err) {
      toast.error(inviteErrorMessage(err));
    }
  };

  if (result) {
    return (
      <div className="space-y-3">
        <LinkRow link={result.link} emailed={result.emailed} note={result.email_error} />
        <Button
          type="button" variant="outline" size="sm"
          onClick={() => { setResult(null); setEmail(""); setAdmin(false); setTitles([]); }}
        >
          Convidar outra pessoa
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="invite_email" className="text-xs text-muted-foreground">E-mail da pessoa</Label>
        <Input
          id="invite_email" type="email" required autoComplete="off" placeholder="nome@empresa.com"
          value={email} onChange={(e) => setEmail(e.target.value)} className="h-10"
        />
      </div>
      <CargoMultiSelect selected={titles} onChange={setTitles} label="Cargo(s)" />
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-card/20 p-3">
        <Checkbox checked={admin} onCheckedChange={(v) => setAdmin(!!v)} className="mt-0.5" />
        <div>
          <span className="text-sm font-medium">Administrador</span>
          <p className="text-xs text-muted-foreground">Acesso total: usuários, configurações e financeiro.</p>
        </div>
      </label>
      <Button type="submit" disabled={create.isPending || !email.trim()} className="w-full">
        {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Enviar convite
      </Button>
    </form>
  );
}

export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-muted-foreground" /> Convidar para a agência
          </DialogTitle>
        </DialogHeader>
        <InviteForm />
      </DialogContent>
    </Dialog>
  );
}

// Invites sent and not yet used, with copy / cancel.
export function PendingInvites() {
  const invitesQ = useAgencyInvites();
  const revoke = useRevokeInvite();
  const list = invitesQ.data ?? [];
  if (list.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card/30 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4 text-muted-foreground" />
        {list.length} convite{list.length > 1 ? "s" : ""} aguardando aceite
      </p>
      <div className="divide-y divide-border/50">
        {list.map((inv) => {
          const days = Math.max(0, Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86_400_000));
          return (
            <div key={inv.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  {inv.role === "admin" ? "Administrador" : "Colaborador"}
                  {inv.role_titles.length > 0 && ` · ${inv.role_titles.join(", ")}`} · expira em {days}d
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => copy(inviteLink(inv.token))}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Link
              </Button>
              <Button
                size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(inv.id, { onError: () => toast.error("Não foi possível cancelar o convite") })}
                aria-label="Cancelar convite"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
