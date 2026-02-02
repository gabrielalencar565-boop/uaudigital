import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
const loginSignupSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72)
});
const forgotSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255)
});
const resetSchema = z.object({
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
  confirm_password: z.string().min(6, "Mínimo 6 caracteres").max(72)
}).refine(v => v.password === v.confirm_password, {
  message: "As senhas não conferem",
  path: ["confirm_password"]
});
type LoginSignupValues = z.infer<typeof loginSignupSchema>;
type ForgotValues = z.infer<typeof forgotSchema>;
type ResetValues = z.infer<typeof resetSchema>;
type AuthMode = "login" | "signup" | "forgot" | "reset";
export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user
  } = useSession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const title = useMemo(() => {
    if (mode === "signup") return "Criar conta";
    if (mode === "forgot") return "Recuperar senha";
    if (mode === "reset") return "Definir nova senha";
    return "Entrar";
  }, [mode]);
  const loginSignupForm = useForm<LoginSignupValues>({
    resolver: zodResolver(loginSignupSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });
  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: ""
    }
  });
  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirm_password: ""
    }
  });
  useEffect(() => {
    if (user) navigate("/", {
      replace: true
    });
  }, [user, navigate]);
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const m = qs.get("mode");
    if (m === "reset") setMode("reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (mode !== "reset") {
      setHasRecoverySession(null);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({
      data
    }) => {
      if (cancelled) return;
      setHasRecoverySession(!!data.session);
    }).catch(() => {
      if (cancelled) return;
      setHasRecoverySession(false);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);
  const onLoginSignup = async (values: LoginSignupValues) => {
    try {
      const emailRedirectTo = `${window.location.origin}/`;
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo,
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }

        // Cria uma solicitação de acesso (pendente) para o admin aprovar.
        // (usamos `note` para armazenar o email e facilitar a identificação no painel admin)
        try {
          if (data.user?.id) {
            const req = await supabase.from("access_requests").insert({
              user_id: data.user.id,
              note: values.email,
              status: "pending",
            });
            if (req.error) {
              // Importante: não deixar o usuário logado/entrando no painel sem estar no fluxo de aprovação.
              // Se falhar registrar a solicitação, seguimos para /pending mesmo assim e avisamos.
              toast.error(req.error.message);
            }
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
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Login realizado. Projeto fluindo bem 🚀");
      navigate("/", { replace: true });
    } catch (e: any) {
      // Segurança: evita crash/tela branca por exceções inesperadas
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  };
  const onForgot = async (values: ForgotValues) => {
    try {
      const redirectTo = `${window.location.origin}/auth?mode=reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Enviamos um link para redefinir sua senha.");
      toast.message("Verifique sua caixa de entrada e o spam.");
      setMode("login");
    } catch (e: any) {
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  };
  const onReset = async (values: ResetValues) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Senha atualizada com sucesso.");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Ocorreu um erro inesperado. Tente novamente.");
    }
  };
  return <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto min-h-screen max-w-6xl px-6 py-10 flex-row flex items-center justify-start">
        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card/30 px-4 py-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-brand shadow-glow" />
              Sistema interno • Uau Digital
            </div>

            <h1 className="uau-text-gradient-auth mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-9xl">Uau ou Nada!
            </h1>
            <p className="mt-4 max-w-prose text-muted-foreground">Aqui, cada tarefa carrega o nome da agência.</p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="uau-surface uau-sheen rounded-xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">🎯 Missão</p>
                <p className="mt-1 font-medium">Transformar marcas e impulsionar negócios no digital.</p>
              </div>
              <div className="uau-surface rounded-xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">👀  Visão</p>
                <p className="mt-1 font-medium">Ser referência em marketing estratégico, com inovação, excelência e resultados.</p>
              </div>
              <div className="uau-surface rounded-xl border border-border/60 p-4">
                <p className="text-xs text-muted-foreground">❤️  Valores</p>
                <ul className="mt-1 space-y-1 font-medium">
                  <li>- Propósito</li>
                  <li>- Resultado</li>
                  <li>- Excelência</li>
                  <li>- Evolução</li>
                </ul>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {mode === "login" && "Acesse o painel interno."}
                {mode === "signup" && "Crie sua conta para começar."}
                {mode === "forgot" && "Vamos te enviar um link de recuperação."}
                {mode === "reset" && "Defina sua nova senha para entrar novamente."}
              </CardDescription>
            </CardHeader>

            {(mode === "login" || mode === "signup") && <form onSubmit={loginSignupForm.handleSubmit(onLoginSignup)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" {...loginSignupForm.register("email")} />
                    {loginSignupForm.formState.errors.email && <p className="text-sm text-danger">{loginSignupForm.formState.errors.email.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...loginSignupForm.register("password")} />
                    {loginSignupForm.formState.errors.password && <p className="text-sm text-danger">{loginSignupForm.formState.errors.password.message}</p>}
                    {mode === "login" && <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => setMode("forgot")}>
                        Esqueci minha senha
                      </Button>}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" variant="hero" className="w-full">
                    {mode === "login" ? "Entrar" : "Criar conta"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(m => m === "login" ? "signup" : "login")}>
                    {mode === "login" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
                  </Button>
                </CardFooter>
              </form>}

            {mode === "forgot" && <form onSubmit={forgotForm.handleSubmit(onForgot)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot_email">Email</Label>
                    <Input id="forgot_email" type="email" autoComplete="email" {...forgotForm.register("email")} />
                    {forgotForm.formState.errors.email && <p className="text-sm text-danger">{forgotForm.formState.errors.email.message}</p>}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" variant="hero" className="w-full">
                    Enviar link
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
                    Voltar para login
                  </Button>
                </CardFooter>
              </form>}

            {mode === "reset" && <form onSubmit={resetForm.handleSubmit(onReset)}>
                <CardContent className="space-y-4">
                  {hasRecoverySession === false && <div className="space-y-1 rounded-lg border border-border/60 bg-card/30 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Link inválido ou expirado</p>
                      <p>Volte e solicite um novo link de recuperação.</p>
                    </div>}

                  <div className="space-y-2">
                    <Label htmlFor="new_password">Nova senha</Label>
                    <Input id="new_password" type="password" autoComplete="new-password" {...resetForm.register("password")} />
                    {resetForm.formState.errors.password && <p className="text-sm text-danger">{resetForm.formState.errors.password.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirmar nova senha</Label>
                    <Input id="confirm_password" type="password" autoComplete="new-password" {...resetForm.register("confirm_password")} />
                    {resetForm.formState.errors.confirm_password && <p className="text-sm text-danger">{resetForm.formState.errors.confirm_password.message}</p>}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" variant="hero" className="w-full" disabled={hasRecoverySession === false}>
                    Salvar nova senha
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("forgot")}>
                    Solicitar novo link
                  </Button>
                </CardFooter>
              </form>}
          </Card>
        </div>
      </div>
    </div>;
}