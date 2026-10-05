import { type ChangeEvent, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Camera, Crop, ImagePlus, Loader2 } from "lucide-react";

import { UauSidebarShell, type MainTab } from "@/components/layout/UauSidebarShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { usePermission } from "@/hooks/use-permission";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CargoMultiSelect } from "@/components/CargoMultiSelect";
import { AvatarCropDialog } from "@/features/meu-painel/components/AvatarCropDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseAppPath, tabPath } from "@/lib/app-routes";
import type { AdminSubTab } from "@/features/admin/AdminContainer";

// Painéis carregados sob demanda (só o que a aba ativa precisa entra no bundle inicial).
const PerformancePanel = lazy(() => import("@/features/performance/PerformancePanel").then((m) => ({ default: m.PerformancePanel })));
const Magic2Panel = lazy(() => import("@/features/magic2/Magic2Panel").then((m) => ({ default: m.Magic2Panel })));
const DayViewPanel = lazy(() => import("@/features/dayview/DayViewPanel").then((m) => ({ default: m.DayViewPanel })));
const MeuPainelPanel = lazy(() => import("@/features/meu-painel/MeuPainelPanel").then((m) => ({ default: m.MeuPainelPanel })));
const AdminContainer = lazy(() => import("@/features/admin/AdminContainer").then((m) => ({ default: m.AdminContainer })));
const FinanceiroPanel = lazy(() => import("@/features/financeiro/FinanceiroPanel").then((m) => ({ default: m.FinanceiroPanel })));
const FinMetasTab = lazy(() => import("@/features/financeiro/components/FinMetasTab").then((m) => ({ default: m.FinMetasTab })));
const FinReceitasDespesasTab = lazy(() => import("@/features/financeiro/components/FinReceitasDespesasTab").then((m) => ({ default: m.FinReceitasDespesasTab })));
const FinDespesasDetalhadasTab = lazy(() => import("@/features/financeiro/components/FinDespesasDetalhadasTab").then((m) => ({ default: m.FinDespesasDetalhadasTab })));
const FinLancamentosTab = lazy(() => import("@/features/financeiro/components/FinLancamentosTab").then((m) => ({ default: m.FinLancamentosTab })));
const GestaoPanel = lazy(() => import("@/features/gestao/GestaoPanel").then((m) => ({ default: m.GestaoPanel })));
const ProjetosPanel = lazy(() => import("@/features/projetos/ProjetosPanel").then((m) => ({ default: m.ProjetosPanel })));
const ConversasPanel = lazy(() => import("@/features/conversas/ConversasPanel").then((m) => ({ default: m.ConversasPanel })));
const ComercialPanel = lazy(() => import("@/features/admin/comercial/ComercialPanel").then((m) => ({ default: m.ComercialPanel })));
const ClientesPanel = lazy(() => import("@/features/clientes/ClientesPanel").then((m) => ({ default: m.ClientesPanel })));
const AjudaPanel = lazy(() => import("@/features/ajuda/AjudaPanel").then((m) => ({ default: m.AjudaPanel })));

function PanelLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_titles: z.array(z.string()).min(1, "Selecione ao menos um cargo"),
});
type ProfileValues = z.infer<typeof profileSchema>;

// Map sidebar tabs to GestaoPanel views
const GESTAO_VIEW_MAP: Record<string, string> = {
  agenda_gestao: "agenda",
  pauta_pessoas: "equipe",
  calendario_publicacao: "calendario",
  cronograma: "cronograma",
  fluxos: "fluxo",
  gestao_por_cliente: "clientes",
  gestao_montagem_pauta: "pauta",
};

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tab, adminSubTab, taskId, clienteId } = useMemo(
    () => parseAppPath(location.pathname),
    [location.pathname]
  );
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  // Quem além de admin pode ver Financeiro/Comercial é configurável em Configurações →
  // Permissões — a leitura dos dados em si (RLS) continua restrita a admin, então liberar
  // aqui só abre a aba; sem dado extra liberado no banco.
  const canSeeFinanceiro = usePermission("tab_financeiro");
  const canSeeComercial = usePermission("tab_comercial");

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => navigate(tabPath("desempenho"));
    window.addEventListener("open-appeal-review", handler);
    return () => window.removeEventListener("open-appeal-review", handler);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const clientId = (e as CustomEvent<{ clientId?: string }>).detail?.clientId;
      navigate(clientId ? `${tabPath("clientes", { clienteId: clientId })}?secao=cronograma` : tabPath("clientes"));
    };
    window.addEventListener("open-calendario-publicacao", handler);
    return () => window.removeEventListener("open-calendario-publicacao", handler);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: MainTab } | undefined;
      if (detail?.tab) navigate(tabPath(detail.tab));
    };
    window.addEventListener("uau:switch-tab", handler);
    return () => window.removeEventListener("uau:switch-tab", handler);
  }, [navigate]);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", role_titles: [] },
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setHasProfile(false); return; }
        setHasProfile(!!data);
      });
    return () => { cancelled = true; };
  }, [user]);

  const onboardingText = useMemo(() => {
    if (isAdmin) return "Como gestor, você cria clientes e tarefas e avalia o time.";
    return "Como colaborador, você conclui apenas suas tarefas e acompanha seu desempenho.";
  }, [isAdmin]);

  const saveProfile = async (v: ProfileValues) => {
    if (!user) return;
    let avatar_url: string | null = null;
    if (avatarBlob) {
      if (avatarBlob.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
      const path = `${user.id}/${crypto.randomUUID()}.webp`;
      const up = await supabase.storage.from("avatars").upload(path, avatarBlob, { upsert: true, contentType: "image/webp" });
      if (up.error) { toast.error(up.error.message); return; }
      const pub = supabase.storage.from("avatars").getPublicUrl(path);
      avatar_url = pub.data.publicUrl ?? null;
    }
    const { error } = await supabase.from("profiles").insert({ user_id: user.id, full_name: v.full_name, role_titles: v.role_titles, avatar_url });
    if (error) { toast.error(error.message); return; }
    try {
      const existing = await supabase.from("team_members").select("user_id").eq("user_id", user.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        const up = await supabase.from("team_members").update({ display_name: v.full_name, role_titles: v.role_titles, avatar_url, is_active: true }).eq("user_id", user.id);
        if (up.error) throw up.error;
      } else {
        const ins = await supabase.from("team_members").insert({ user_id: user.id, display_name: v.full_name, role_titles: v.role_titles, avatar_url, is_active: true });
        if (ins.error) throw ins.error;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar dados públicos do time");
    }
    toast.success("Perfil pronto — bora acelerar 🚀");
    setHasProfile(true);
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem (PNG/JPG/WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }

    const url = URL.createObjectURL(file);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(url);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [cropSrc]);

  const handleCropConfirm = useCallback((blob: Blob) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (cropSrc) URL.revokeObjectURL(cropSrc);

    setAvatarPreview(URL.createObjectURL(blob));
    setAvatarBlob(blob);
    setCropSrc(null);
  }, [avatarPreview, cropSrc]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const gestaoView = GESTAO_VIEW_MAP[tab];
  const isGestaoTab = !!gestaoView;

  const renderContent = () => {
    if (hasProfile === false) {
      return (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Primeiro acesso</CardTitle>
            <CardDescription>{onboardingText}</CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(saveProfile)}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Foto</Label>
                <div className="flex items-center gap-4">
                  {avatarPreview ? (
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={avatarPreview} alt="Foto do perfil" />
                            <AvatarFallback>{initials(form.watch("full_name") || "?")}</AvatarFallback>
                          </Avatar>
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/65 text-background opacity-0 transition-opacity group-hover:opacity-100">
                            <Camera className="h-4 w-4" />
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-1" align="start">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setPopoverOpen(false); fileInputRef.current?.click(); }}
                        >
                          <ImagePlus className="h-4 w-4" /> Alterar foto
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setPopoverOpen(false); setCropSrc(avatarPreview); }}
                        >
                          <Crop className="h-4 w-4" /> Ajustar foto
                        </button>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar className="h-14 w-14">
                        <AvatarFallback>{initials(form.watch("full_name") || "?")}</AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/65 text-background opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="h-4 w-4" />
                      </div>
                    </button>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{avatarPreview ? "Clique na foto para opções" : "Clique na foto para escolher"}</p>
                    <p className="text-xs text-muted-foreground">PNG/JPG/WebP • até 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </div>
                <AvatarCropDialog
                  open={!!cropSrc}
                  imageSrc={cropSrc ?? ""}
                  onConfirm={handleCropConfirm}
                  onCancel={handleCropCancel}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome</Label>
                <Input id="full_name" placeholder="Seu nome" {...form.register("full_name")} />
                {form.formState.errors.full_name && <p className="text-sm text-danger">{form.formState.errors.full_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Controller
                  control={form.control}
                  name="role_titles"
                  render={({ field }) => (
                    <CargoMultiSelect selected={field.value} onChange={field.onChange} />
                  )}
                />
                {form.formState.errors.role_titles && <p className="text-sm text-danger">{form.formState.errors.role_titles.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="hero">Entrar no painel</Button>
            </CardFooter>
          </form>
        </Card>
      );
    }
    if (isGestaoTab && tab !== "calendario_publicacao")
      return (
        <GestaoPanel
          forcedView={gestaoView}
          initialTaskId={taskId}
          onTaskOpen={(id) => navigate(tabPath(tab, { taskId: id }))}
          onTaskDialogClose={() => navigate(tabPath(tab))}
        />
      );
    if (tab === "visao_geral_projetos") return <ProjetosPanel />;
    if (tab === "configuracoes" && isAdmin)
      return (
        <AdminContainer
          onNavigate={(t) => navigate(tabPath(t as MainTab))}
          initialSubTab={(adminSubTab as AdminSubTab | undefined) ?? null}
          onSubTabChange={(next) => navigate(tabPath("configuracoes", { adminSubTab: next }))}
          initialClienteId={clienteId}
          onClienteIdChange={(id) => navigate(tabPath("configuracoes", { adminSubTab: "clientes", clienteId: id }))}
        />
      );
    if (tab === "conversas" && isAdmin) return <ConversasPanel />;
    if (tab === "comercial" && canSeeComercial) return <ComercialPanel />;
    // Cronograma e Resultados viraram seções dentro de Clientes — links antigos caem lá.
    if (tab === "resultados" || tab === "calendario_publicacao") return <Navigate to="/clientes" replace />;
    if (tab === "clientes") {
      return <ClientesPanel clienteId={clienteId ?? null} onClienteChange={(id) => navigate(tabPath("clientes", { clienteId: id }))} />;
    }
    if (tab === "financeiro" && canSeeFinanceiro) return <FinanceiroPanel />;
    if (tab === "fin_clientes" && canSeeFinanceiro) return <AdminContainer onNavigate={(t) => navigate(tabPath(t as MainTab))} />;
    if (tab === "fin_receitas_despesas" && canSeeFinanceiro) return <FinReceitasDespesasTab />;
    if (tab === "fin_despesas_detalhadas" && canSeeFinanceiro) return <FinDespesasDetalhadasTab />;
    if (tab === "fin_lancamentos" && canSeeFinanceiro) return <FinLancamentosTab />;
    if (tab === "metas" && canSeeFinanceiro) return <FinMetasTab />;
    if (tab === "visao_do_dia") return <DayViewPanel />;
    // A aba Uau XP saiu do menu; links antigos caem no Meu Painel.
    if (tab === "recompensas") return <Navigate to="/" replace />;

    if (tab === "meu_painel") return <MeuPainelPanel />;
    if (tab === "desempenho") return <PerformancePanel />;
    if (tab === "magic2") return <Magic2Panel />;
    if (tab === "ajuda") return <AjudaPanel />;
    return <MeuPainelPanel />;
  };

  return (
    <UauSidebarShell
      tab={tab}
      isAdmin={isAdmin}
      canSeeFinanceiro={canSeeFinanceiro}
      canSeeComercial={canSeeComercial}
      onTabChange={(next) => {
        try {
          navigate(tabPath(next));
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        } catch (e) {
          console.error("Falha ao trocar de aba:", e);
          toast.error("Não foi possível abrir esta aba. Tente recarregar.");
        }
      }}
    >
      <Suspense fallback={<PanelLoadingFallback />}>{renderContent()}</Suspense>
    </UauSidebarShell>
  );
};

export default Index;
