import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Camera, Crop, ImagePlus } from "lucide-react";

import { UauSidebarShell, type MainTab } from "@/components/layout/UauSidebarShell";
import { PerformancePanel } from "@/features/performance/PerformancePanel";
import { Magic2Panel } from "@/features/magic2/Magic2Panel";
import { DayViewPanel } from "@/features/dayview/DayViewPanel";
import { MeuPainelPanel } from "@/features/meu-painel/MeuPainelPanel";
import { AdminContainer } from "@/features/admin/AdminContainer";
import { FinanceiroPanel } from "@/features/financeiro/FinanceiroPanel";
import { FinMetasTab } from "@/features/financeiro/components/FinMetasTab";

import { FinReceitasDespesasTab } from "@/features/financeiro/components/FinReceitasDespesasTab";
import { FinDespesasDetalhadasTab } from "@/features/financeiro/components/FinDespesasDetalhadasTab";
import { FinLancamentosTab } from "@/features/financeiro/components/FinLancamentosTab";
import { GestaoPanel } from "@/features/gestao/GestaoPanel";

import { ProjetosPanel } from "@/features/projetos/ProjetosPanel";
import { RecompensasPanel } from "@/features/recompensas/RecompensasPanel";
import { ConversasPanel } from "@/features/conversas/ConversasPanel";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_OPTIONS } from "@/lib/role-options";
import { AvatarCropDialog } from "@/features/meu-painel/components/AvatarCropDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_title: z.string().trim().min(2, "Informe seu cargo").max(120),
});
type ProfileValues = z.infer<typeof profileSchema>;

// Map sidebar tabs to GestaoPanel views
const GESTAO_VIEW_MAP: Record<string, string> = {
  tarefas: "kanban",
  agenda_gestao: "agenda",
  cronograma: "cronograma",
  fluxos: "fluxo",
};

const Index = () => {
  const [tab, setTab] = useState<MainTab>("meu_painel");
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", role_title: "" },
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
    const { error } = await supabase.from("profiles").insert({ user_id: user.id, full_name: v.full_name, role_title: v.role_title, avatar_url });
    if (error) { toast.error(error.message); return; }
    try {
      const existing = await supabase.from("team_members").select("user_id").eq("user_id", user.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        const up = await supabase.from("team_members").update({ display_name: v.full_name, role_title: v.role_title, avatar_url, is_active: true }).eq("user_id", user.id);
        if (up.error) throw up.error;
      } else {
        const ins = await supabase.from("team_members").insert({ user_id: user.id, display_name: v.full_name, role_title: v.role_title, avatar_url, is_active: true });
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
                <Label htmlFor="role_title">Cargo</Label>
                <Controller
                  control={form.control}
                  name="role_title"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="role_title">
                        <SelectValue placeholder="Selecione seu cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.role_title && <p className="text-sm text-danger">{form.formState.errors.role_title.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="hero">Entrar no painel</Button>
            </CardFooter>
          </form>
        </Card>
      );
    }
    if (isGestaoTab) return <GestaoPanel forcedView={gestaoView} />;
    if (tab === "visao_geral_projetos") return <ProjetosPanel />;
    if (tab === "configuracoes" && isAdmin) return <AdminContainer onNavigate={(t) => setTab(t as any)} />;
    if (tab === "conversas" && isAdmin) return <ConversasPanel />;
    if (tab === "financeiro" && isAdmin) return <FinanceiroPanel />;
    if (tab === "fin_clientes" && isAdmin) return <AdminContainer onNavigate={(t) => setTab(t as any)} />;
    if (tab === "fin_receitas_despesas" && isAdmin) return <FinReceitasDespesasTab />;
    if (tab === "fin_despesas_detalhadas" && isAdmin) return <FinDespesasDetalhadasTab />;
    if (tab === "fin_lancamentos" && isAdmin) return <FinLancamentosTab />;
    if (tab === "metas" && isAdmin) return <FinMetasTab />;
    if (tab === "visao_do_dia") return <DayViewPanel />;
    if (tab === "recompensas") {
      if (isAdmin) return <RecompensasPanel />;
      return (
        <div className="relative">
          <div className="pointer-events-none select-none blur-[1px] opacity-95">
            <RecompensasPanel />
          </div>
          <div className="absolute inset-0 bg-background/15 flex items-start justify-center pt-32 z-10">
            <div className="max-w-md mx-4 rounded-2xl border border-amber-400/30 bg-card/95 backdrop-blur-xl shadow-2xl p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
                backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, hsl(var(--foreground)) 8px, hsl(var(--foreground)) 16px)"
              }} />
              <div className="relative">
                <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 ring-1 ring-amber-400/30">
                  <span className="text-2xl">🔒</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Uau XP em construção</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  Estamos preparando algo incrível por aqui ✨
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Em breve você poderá trocar XP por prêmios reais.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (tab === "meu_painel") return <MeuPainelPanel />;
    if (tab === "desempenho") return <PerformancePanel />;
    if (tab === "magic2") return <Magic2Panel />;
    return <MeuPainelPanel />;
  };

  return (
    <UauSidebarShell
      tab={tab}
      isAdmin={isAdmin}
      onTabChange={(next) => {
        try {
          setTab(next);
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        } catch (e) {
          console.error("Falha ao trocar de aba:", e);
          toast.error("Não foi possível abrir esta aba. Tente recarregar.");
        }
      }}
    >
      {renderContent()}
    </UauSidebarShell>
  );
};

export default Index;
