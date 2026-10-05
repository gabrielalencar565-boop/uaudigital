import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Public landing for an invite link. The person either arrives from the e-mail (already signed in, but with no
// password yet), or opens a link someone shared (signed out → create account / log in). In every case the invite is
// only accepted with the e-mail it was sent to.

const sb = supabase as any;

type Preview = { agency_name: string; logo_url: string | null; email: string; role: string; status: "valid" | "expired" | "accepted" | "revoked" };
type Mode = "signup" | "login";

const ACCEPT_ERRORS: Record<string, string> = {
  email_mismatch: "Este convite foi enviado para outro e-mail.",
  invite_expired: "Este convite expirou. Peça um novo para quem convidou você.",
  invite_revoked: "Este convite foi cancelado.",
  invite_used: "Este convite já foi usado.",
  already_in_other_agency: "Esta conta já pertence a outra agência.",
  invalid_name: "Informe seu nome (2 a 80 letras).",
};

const inputCls = "h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25";

export default function Convite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: sessionLoading } = useSession();

  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sb.rpc("get_invite_preview", { p_token: token }).then(({ data }: { data: Preview[] | null }) => {
      if (!cancelled) setPreview(data?.[0] ?? null);
    });
    return () => { cancelled = true; };
  }, [token]);

  const accept = useCallback(async (fullName: string) => {
    const { error } = await sb.rpc("accept_agency_invite", { p_token: token, p_full_name: fullName });
    if (error) { toast.error(ACCEPT_ERRORS[error.message] ?? "Não foi possível aceitar o convite."); return false; }
    await qc.invalidateQueries();
    toast.success("Bem-vindo(a) à agência!");
    navigate("/meu-painel", { replace: true });
    return true;
  }, [token, navigate, qc]);

  const signedEmail = user?.email?.toLowerCase();
  const wrongAccount = !!(user && preview && signedEmail !== preview.email.toLowerCase());
  // e-mailed invites create the account without a password — ask for one now
  const needsPassword = !!user && user.user_metadata?.signup_type === "invite" && !user.user_metadata?.password_set;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setBusy(true);
    try {
      if (user) {
        if (needsPassword) {
          if (password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres"); return; }
          const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
          if (error) { toast.error(error.message); return; }
        }
        await accept(name);
        return;
      }
      if (password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres"); return; }
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: preview.email, password });
        if (error) { toast.error(error.message); return; }
        await accept(name || preview.email.split("@")[0]);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: preview.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/convite/${token}`,
          data: { signup_type: "invite", password_set: true, full_name: name },
        },
      });
      if (error) { toast.error(error.message); return; }
      if (data.session) await accept(name);
      else setConfirmEmail(true);
    } finally {
      setBusy(false);
    }
  };

  const loading = sessionLoading || preview === undefined;
  const invalid = !loading && (preview === null || preview.status !== "valid");
  const message = preview === null ? "Convite não encontrado."
    : preview?.status === "expired" ? "Este convite expirou. Peça um novo para quem convidou você."
    : preview?.status === "revoked" ? "Este convite foi cancelado."
    : preview?.status === "accepted" ? "Este convite já foi usado. Entre com a sua conta."
    : "";

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10" style={{ background: "#0B0B0B" }}>
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(124,58,237,0.18), transparent 60%)" }}
      />
      <div className="relative z-10 w-full max-w-sm space-y-7">
        <img
          src={preview?.logo_url || "/branding/fluxo-mark-white.png"} alt=""
          className="mx-auto h-12 w-auto object-contain"
        />

        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/50" />}

        {invalid && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/70">{message}</p>
            <Button variant="outline" onClick={() => navigate("/auth")}>Ir para o login</Button>
          </div>
        )}

        {!loading && preview?.status === "valid" && wrongAccount && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/70">
              Você está conectado como <b className="text-white">{user?.email}</b>, mas este convite é para{" "}
              <b className="text-white">{preview.email}</b>.
            </p>
            <Button
              variant="outline"
              onClick={async () => { await supabase.auth.signOut(); }}
            >
              Sair e continuar
            </Button>
          </div>
        )}

        {!loading && preview?.status === "valid" && confirmEmail && (
          <p className="text-center text-sm text-white/70">
            Enviamos um link de confirmação para <b className="text-white">{preview.email}</b>. Clique nele para entrar na
            agência <b className="text-white">{preview.agency_name}</b>.
          </p>
        )}

        {!loading && preview?.status === "valid" && !wrongAccount && !confirmEmail && (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">Entrar em {preview.agency_name}</h1>
              <p className="text-sm text-white/50">
                {user || mode === "signup" ? "Complete seu acesso para começar." : "Entre com sua conta para aceitar."}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-white/70">E-mail</Label>
              <Input value={preview.email} readOnly className={`${inputCls} opacity-70`} />
            </div>

            {(user || mode === "signup") && (
              <div className="space-y-2">
                <Label htmlFor="inv_name" className="text-xs uppercase tracking-wider text-white/70">Seu nome</Label>
                <Input
                  id="inv_name" required value={name} maxLength={80} autoComplete="name"
                  onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado(a)" className={inputCls}
                />
              </div>
            )}

            {(!user || needsPassword) && (
              <div className="space-y-2">
                <Label htmlFor="inv_pw" className="text-xs uppercase tracking-wider text-white/70">
                  {mode === "login" && !user ? "Senha" : "Crie uma senha"}
                </Label>
                <Input
                  id="inv_pw" type="password" required minLength={6} maxLength={72} value={password}
                  autoComplete={mode === "login" && !user ? "current-password" : "new-password"}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls}
                />
              </div>
            )}

            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl font-semibold">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? "Entrar na agência" : mode === "signup" ? "Criar acesso" : "Entrar e aceitar"}
            </Button>

            {!user && (
              <button
                type="button"
                className="w-full text-center text-sm text-white/40 transition-colors hover:text-white/60"
                onClick={() => setMode((m) => (m === "signup" ? "login" : "signup"))}
              >
                {mode === "signup" ? "Já tenho conta" : "Ainda não tenho conta"}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
