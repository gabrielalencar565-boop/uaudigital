import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteForm, PendingInvites } from "@/features/admin/AgencyInvites";
import { cn } from "@/lib/utils";

// New agency owners land here right after signing up (and confirming their e-mail): the agency is created from the
// signup data, then a short guided setup — look & feel, then inviting the team. Everything after the agency exists
// is optional and can be done later in Configurações.

const sb = supabase as any;
const SWATCHES = ["#6932c9", "#2563eb", "#0e7490", "#059669", "#d97706", "#dc2626", "#db2777", "#334155"];
const STEPS = ["Identidade", "Equipe"] as const;

type Phase = "loading" | "create" | "steps";

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useSession();

  const [phase, setPhase] = useState<Phase>("loading");
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [savingColor, setSavingColor] = useState(false);
  const started = useRef(false);

  const createAgency = useCallback(async (name: string, person: string) => {
    setCreating(true);
    const { error } = await sb.rpc("create_my_agency", { p_agency_name: name, p_full_name: person });
    setCreating(false);
    if (error) {
      toast.error(
        error.message === "invalid_agency_name" ? "Informe o nome da agência (2 a 80 letras)."
        : error.message === "invalid_name" ? "Informe seu nome (2 a 80 letras)."
        : "Não foi possível criar a agência. Tente novamente.",
      );
      setPhase("create");
      return false;
    }
    // everything cached so far belongs to "no agency yet"
    await qc.invalidateQueries();
    setPhase("steps");
    return true;
  }, [qc]);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    (async () => {
      const { data: agencyId } = await sb.rpc("current_agency_id");
      if (agencyId) {
        const { data: ag } = await sb.from("agencies").select("owner_id,onboarded_at").eq("id", agencyId).maybeSingle();
        // already set up (or just a member of someone's agency): nothing to do here
        if (!ag || ag.owner_id !== user.id || ag.onboarded_at) { navigate("/", { replace: true }); return; }
        setPhase("steps");
        return;
      }
      // invited to someone's agency? that takes priority over starting a new one
      const { data: inviteToken } = await sb.rpc("my_pending_invite");
      if (inviteToken) { navigate(`/convite/${inviteToken}`, { replace: true }); return; }

      const meta = (user.user_metadata ?? {}) as { agency_name?: string; full_name?: string };
      setAgencyName(meta.agency_name ?? "");
      setFullName(meta.full_name ?? "");
      if (meta.agency_name && meta.full_name) await createAgency(meta.agency_name, meta.full_name);
      else setPhase("create");
    })();
  }, [user, navigate, createAgency]);

  const finish = async () => {
    await sb.rpc("complete_onboarding");
    await qc.invalidateQueries();
    navigate("/meu-painel", { replace: true });
  };

  const saveColor = async () => {
    setSavingColor(true);
    try {
      const { data: agencyId } = await sb.rpc("current_agency_id");
      const { error } = await sb.from("app_settings").update({ brand_color: color }).eq("agency_id", agencyId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["app_settings"] });
      setStep(1);
    } catch {
      toast.error("Não foi possível salvar a cor. Você pode ajustar depois em Configurações.");
    } finally {
      setSavingColor(false);
    }
  };

  if (loading) return <Shell><Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" /></Shell>;
  if (!user) return <Navigate to="/auth?mode=signup" replace />;

  return (
    <Shell>
      {phase === "loading" && (
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" />
          <p className="text-sm text-white/50">Preparando sua agência…</p>
        </div>
      )}

      {phase === "create" && (
        <form
          className="space-y-5"
          onSubmit={(e) => { e.preventDefault(); void createAgency(agencyName, fullName); }}
        >
          <Heading title="Vamos criar sua agência" subtitle="Leva menos de um minuto." />
          <Field id="ob_agency" label="Nome da agência" value={agencyName} onChange={setAgencyName} placeholder="Ex: Minha Agência" />
          <Field id="ob_name" label="Seu nome" value={fullName} onChange={setFullName} placeholder="Como você quer ser chamado(a)" />
          <Button type="submit" disabled={creating} className="h-11 w-full rounded-xl font-semibold">
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar agência
          </Button>
        </form>
      )}

      {phase === "steps" && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                    i < step ? "bg-emerald-500 text-white" : i === step ? "bg-white text-black" : "bg-white/10 text-white/40",
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("text-xs", i === step ? "text-white" : "text-white/40")}>{label}</span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-white/15" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <Heading title="Escolha a cor da sua agência" subtitle="Ela aparece no menu, botões e gráficos. Dá para mudar quando quiser." />
              <div className="flex flex-wrap justify-center gap-3">
                {SWATCHES.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
                    className={cn("h-10 w-10 rounded-full ring-offset-2 ring-offset-[#0B0B0B] transition", color === c ? "ring-2 ring-white" : "hover:scale-105")}
                    style={{ background: c }}
                  />
                ))}
                <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/30" title="Outra cor">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute -inset-2 h-16 w-16 cursor-pointer opacity-0" />
                  <span className="flex h-full w-full items-center justify-center text-lg text-white/50">+</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="text-white/60 hover:text-white" onClick={() => setStep(1)}>Pular</Button>
                <Button className="h-11 flex-1 rounded-xl font-semibold" style={{ background: color }} disabled={savingColor} onClick={saveColor}>
                  {savingColor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Heading title="Convide sua equipe" subtitle="Cada pessoa recebe um link para criar o acesso dela. Você pode convidar mais gente depois, em Configurações → Usuários." />
              <div className="rounded-xl bg-background p-4 text-foreground">
                <InviteForm />
              </div>
              <PendingInvites />
              <Button className="h-11 w-full rounded-xl font-semibold" onClick={finish}>
                <PartyPopper className="mr-2 h-4 w-4" /> Concluir e entrar no Fluxo
              </Button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10" style={{ background: "#0B0B0B" }}>
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(124,58,237,0.18), transparent 60%)" }}
      />
      <div className="relative z-10 w-full max-w-md">
        <img src="/branding/fluxo-mark-white.png" alt="Fluxo" className="mx-auto mb-8 h-10 w-auto object-contain" />
        {children}
      </div>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1.5 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
    </div>
  );
}

function Field(props: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className="text-xs uppercase tracking-wider text-white/70">{props.label}</Label>
      <Input
        id={props.id} value={props.value} maxLength={80} placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25"
      />
    </div>
  );
}
