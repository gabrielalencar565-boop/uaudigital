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

/* ── Background slideshow with slow zoom + pan ── */
function BgSlideshow({ images, opacity, posX, posY, zoom }: { images: string[]; opacity: number; posX: number; posY: number; zoom: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {images.map((url, i) => (
        <div
          key={url}
          className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <div
            className="absolute inset-[-10%]"
            style={{
              backgroundImage: `url(${url})`,
              backgroundSize: "cover",
              backgroundPosition: `${posX}% ${posY}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${posX}% ${posY}%`,
              animation: `authBgZoom 18s ease-in-out infinite alternate`,
              animationDelay: `${i * -6}s`,
            }}
          />
        </div>
      ))}
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black" style={{ opacity: 1 - opacity }} />
    </div>
  );
}

/* ── Auth Page ── */
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const appSettings = useAppSettings();
  const bgImages = appSettings.data?.login_bg_images ?? [];

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
    return "";
  }, [mode]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BgSlideshow images={bgImages} opacity={appSettings.data?.login_bg_opacity ?? 0.2} posX={appSettings.data?.login_bg_position_x ?? 50} posY={appSettings.data?.login_bg_position_y ?? 50} zoom={appSettings.data?.login_bg_zoom ?? 1} />

      {/* Fallback dark bg when no images */}
      {bgImages.length === 0 && (
        <div className="pointer-events-none fixed inset-0 z-0 bg-[hsl(263,70%,8%)]" />
      )}

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {/* Login widget — parallax gradient style */}
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl animate-fade-in"
          style={{
            boxShadow: "0 24px 60px -12px rgba(105, 50, 201, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.15)",
          }}
        >
          {/* Parallax gradient header */}
          <div className="relative overflow-hidden px-6 pt-8 pb-6">
            {/* Layer 1 — base gradient */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 30%, #8B5CF6 60%, #7C3AED 100%)",
                backgroundSize: "300% 300%",
                animation: "gradientFlow 8s ease-in-out infinite",
              }}
            />
            {/* Layer 2 — parallax blob */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background: "radial-gradient(600px circle at 20% 40%, rgba(167,139,250,0.6), transparent 60%)",
                animation: "parallaxLayer2 12s ease-in-out infinite",
              }}
            />
            {/* Layer 3 — secondary blob */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: "radial-gradient(400px circle at 80% 60%, rgba(196,181,253,0.5), transparent 50%)",
                animation: "parallaxLayer3 15s ease-in-out infinite",
              }}
            />
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                animation: "gridDrift 20s linear infinite",
              }}
            />

            {/* Text content */}
            <div className="relative z-10 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Que bom ter você aqui!
              </h1>
              <p className="mt-2 text-sm text-white/80 font-medium">
                Bora fazer acontecer — é Uau ou nada! 🚀
              </p>
            </div>
          </div>

          {/* Form area */}
          <div className="bg-card px-6 pb-6 pt-5">
            {subtitle && (
              <p className="mb-4 text-center text-sm text-muted-foreground">{subtitle}</p>
            )}

            {(mode === "login" || mode === "signup") && (
              <form onSubmit={loginSignupForm.handleSubmit(onLoginSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" {...loginSignupForm.register("email")} />
                  {loginSignupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginSignupForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    {...loginSignupForm.register("password")}
                  />
                  {loginSignupForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginSignupForm.formState.errors.password.message}</p>
                  )}
                  {mode === "login" && (
                    <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => setMode("forgot")}>
                      Esqueci minha senha
                    </Button>
                  )}
                </div>
                <Button type="submit" variant="hero" className="w-full">
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}>
                  {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
                </Button>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot_email">Email</Label>
                  <Input id="forgot_email" type="email" autoComplete="email" {...forgotForm.register("email")} />
                  {forgotForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{forgotForm.formState.errors.email.message}</p>
                  )}
                </div>
                <Button type="submit" variant="hero" className="w-full">Enviar link</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>Voltar para login</Button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4">
                {hasRecoverySession === false && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Link inválido ou expirado</p>
                    <p>Volte e solicite um novo link de recuperação.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nova senha</Label>
                  <Input id="new_password" type="password" autoComplete="new-password" {...resetForm.register("password")} />
                  {resetForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{resetForm.formState.errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirmar nova senha</Label>
                  <Input id="confirm_password" type="password" autoComplete="new-password" {...resetForm.register("confirm_password")} />
                  {resetForm.formState.errors.confirm_password && (
                    <p className="text-sm text-destructive">{resetForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={hasRecoverySession === false}>Salvar nova senha</Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("forgot")}>Solicitar novo link</Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
