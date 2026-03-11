import { useEffect, useMemo, useState, useCallback } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { useAppSettings } from "@/features/data/queries";

/* ── Schemas ── */
const loginSignupSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const forgotSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
});
const resetSchema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    confirm_password: z.string().min(6, "Mínimo 6 caracteres").max(72),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "As senhas não conferem",
    path: ["confirm_password"],
  });

type LoginSignupValues = z.infer<typeof loginSignupSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;
type ResetValues = z.infer<typeof resetSchema>;
type AuthMode = "login" | "signup" | "forgot" | "reset";

/* ── Masonry Gallery ── */
function MasonryGallery({ avatars }: { avatars: string[] }) {
  // Split avatars into 3 columns, repeating to fill
  const cols = useMemo(() => {
    if (avatars.length === 0) return [[], [], []];
    const col1: string[] = [];
    const col2: string[] = [];
    const col3: string[] = [];
    // Fill at least 8 items per column for seamless loop
    const minItems = Math.max(8, avatars.length);
    for (let i = 0; i < minItems; i++) {
      const url = avatars[i % avatars.length];
      if (i % 3 === 0) col1.push(url);
      else if (i % 3 === 1) col2.push(url);
      else col3.push(url);
    }
    return [col1, col2, col3];
  }, [avatars]);

  if (avatars.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="h-full w-full"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 40%, #9333EA 70%, #7C3AED 100%)",
            backgroundSize: "300% 300%",
            animation: "gradientFlow 8s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  const directions = ["up", "down", "up"] as const;
  const speeds = ["60s", "70s", "55s"];

  return (
    <div className="flex h-full w-full gap-3 overflow-hidden p-4">
      {cols.map((col, colIdx) => {
        const dir = directions[colIdx];
        const items = [...col, ...col]; // duplicate for seamless loop
        return (
          <div key={colIdx} className="relative flex-1 overflow-hidden rounded-2xl">
            <div
              className="flex flex-col gap-3"
              style={{
                animation: `masonry-${dir} ${speeds[colIdx]} linear infinite`,
              }}
            >
              {items.map((url, i) => (
                <div
                  key={`${colIdx}-${i}`}
                  className="group relative overflow-hidden rounded-2xl"
                  style={{
                    aspectRatio: colIdx === 1 && i % 3 === 0 ? "3/4" : i % 2 === 0 ? "4/5" : "3/4",
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  {/* Subtle gradient overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-10"
                    style={{
                      background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Auth Page ── */
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const appSettings = useAppSettings();
  

  const logoUrl = appSettings.data?.logo_url ?? null;
  const bgImages = appSettings.data?.login_bg_images ?? [];
  const galleryPhotos = useMemo(() => {
    return bgImages.map((img: any) => img.url as string).filter(Boolean);
  }, [bgImages]);

  const [mode, setMode] = useState<AuthMode>("login");
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  const loginSignupForm = useForm<LoginSignupValues>({
    resolver: zodResolver(loginSignupSchema),
    defaultValues: { email: "", password: "" },
  });
  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    if (qs.get("mode") === "reset") setMode("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "reset") {
      setHasRecoverySession(null);
      return;
    }
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setHasRecoverySession(!!data.session);
      })
      .catch(() => {
        if (!cancelled) setHasRecoverySession(false);
      });
    return () => { cancelled = true; };
  }, [mode]);

  const onLoginSignup = useCallback(async (values: LoginSignupValues) => {
    try {
      const emailRedirectTo = `${window.location.origin}/`;
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { emailRedirectTo },
        });
        if (error) { toast.error(error.message); return; }
        try {
          if (data.user?.id) {
            const req = await supabase.from("access_requests").insert({
              user_id: data.user.id,
              note: values.email,
              status: "pending",
            });
            if (req.error) toast.error(req.error.message);
          }
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao registrar solicitação de acesso");
        } finally {
          await supabase.auth.signOut();
        }
        toast.success("Cadastro criado! Agora aguarde aprovação do admin.");
        navigate("/pending?status=pending", { replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Login realizado. Projeto fluindo bem 🚀");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  }, [mode, navigate]);

  const onForgot = useCallback(async (values: ForgotValues) => {
    try {
      const redirectTo = `${window.location.origin}/auth?mode=reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, { redirectTo });
      if (error) { toast.error(error.message); return; }
      toast.success("Enviamos um link para redefinir sua senha.");
      toast.message("Verifique sua caixa de entrada e o spam.");
      setMode("login");
    } catch (e: any) {
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  }, []);

  const onReset = useCallback(async (values: ResetValues) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) { toast.error(error.message); return; }
      toast.success("Senha atualizada com sucesso.");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  }, [navigate]);

  const subtitle = useMemo(() => {
    if (mode === "signup") return "Crie sua conta para começar.";
    if (mode === "forgot") return "Vamos te enviar um link de recuperação.";
    if (mode === "reset") return "Defina sua nova senha para entrar novamente.";
    return null;
  }, [mode]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Left Column: Login ─── */}
      <div
        className="relative z-10 flex w-full flex-col items-center justify-center px-8 py-10 md:w-[42%] md:min-w-[400px]"
        style={{ background: "#0B0B0B" }}
      >
        {/* Subtle gradient accent */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse at 30% 0%, rgba(124,58,237,0.15), transparent 60%)",
          }}
        />

        <div className="relative z-10 w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="flex justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <span className="text-lg font-bold text-primary-foreground">U</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {mode === "login" && "Que bom ter você aqui!"}
              {mode === "signup" && "Crie sua conta"}
              {mode === "forgot" && "Recuperar senha"}
              {mode === "reset" && "Nova senha"}
            </h1>
            <p className="text-sm text-white/50">
              {subtitle ?? "Bora fazer acontecer é Uau ou nada! 🚀"}
            </p>
          </div>

          {/* Forms */}
          {(mode === "login" || mode === "signup") && (
            <form onSubmit={loginSignupForm.handleSubmit(onLoginSignup)} className="space-y-5 w-full">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70 text-xs uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20"
                  {...loginSignupForm.register("email")}
                />
                {loginSignupForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{loginSignupForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70 text-xs uppercase tracking-wider">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20"
                  {...loginSignupForm.register("password")}
                />
                {loginSignupForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{loginSignupForm.formState.errors.password.message}</p>
                )}
              </div>

              {mode === "login" && (
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/30"
                    />
                    <span className="text-xs text-white/40">Manter conectado</span>
                  </label>
                  <button
                    type="button"
                    className="text-xs text-white/40 transition-colors hover:text-white/70"
                    onClick={() => setMode("forgot")}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl font-semibold text-white shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #7C3AED 100%)",
                  backgroundSize: "200% 200%",
                  animation: "gradientFlow 4s ease-in-out infinite",
                }}
              >
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>

              <button
                type="button"
                className="w-full text-center text-sm text-white/40 transition-colors hover:text-white/60"
                onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
              >
                {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-5 w-full">
              <div className="space-y-2">
                <Label htmlFor="forgot_email" className="text-white/70 text-xs uppercase tracking-wider">Email</Label>
                <Input
                  id="forgot_email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20"
                  {...forgotForm.register("email")}
                />
                {forgotForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{forgotForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl font-semibold text-white shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #7C3AED 100%)",
                  backgroundSize: "200% 200%",
                  animation: "gradientFlow 4s ease-in-out infinite",
                }}
              >
                Enviar link
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-white/40 transition-colors hover:text-white/60"
                onClick={() => setMode("login")}
              >
                Voltar para login
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-5 w-full">
              {hasRecoverySession === false && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  <p className="font-medium">Link inválido ou expirado</p>
                  <p className="text-red-300/70">Volte e solicite um novo link de recuperação.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new_password" className="text-white/70 text-xs uppercase tracking-wider">Nova senha</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20"
                  {...resetForm.register("password")}
                />
                {resetForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{resetForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-white/70 text-xs uppercase tracking-wider">Confirmar nova senha</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/25 focus:border-purple-500/50 focus:ring-purple-500/20"
                  {...resetForm.register("confirm_password")}
                />
                {resetForm.formState.errors.confirm_password && (
                  <p className="text-sm text-red-400">{resetForm.formState.errors.confirm_password.message}</p>
                )}
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-xl font-semibold text-white shadow-lg"
                disabled={hasRecoverySession === false}
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #7C3AED 100%)",
                  backgroundSize: "200% 200%",
                  animation: "gradientFlow 4s ease-in-out infinite",
                }}
              >
                Salvar nova senha
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-white/40 transition-colors hover:text-white/60"
                onClick={() => setMode("forgot")}
              >
                Solicitar novo link
              </button>
            </form>
          )}
        </div>

        {/* Bottom credit */}
        <p className="absolute bottom-4 text-[10px] text-white/20">© Uau Digital</p>
      </div>

      {/* ─── Right Column: Photo Gallery ─── */}
      <div
        className="relative hidden flex-1 overflow-hidden md:block"
        style={{ background: "#0B0B0B" }}
      >
        <MasonryGallery avatars={galleryPhotos} />
      </div>
    </div>
  );
}
