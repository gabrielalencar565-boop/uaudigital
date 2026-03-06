import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { UauSidebarShell, type MainTab } from "@/components/layout/UauSidebarShell";
import { PerformancePanel } from "@/features/performance/PerformancePanel";
import { Magic2Panel } from "@/features/magic2/Magic2Panel";
import { GestaoPanel } from "@/features/gestao/GestaoPanel";
import { DayViewPanel } from "@/features/dayview/DayViewPanel";
import { MeuPainelPanel } from "@/features/meu-painel/MeuPainelPanel";
import { AdminContainer } from "@/features/admin/AdminContainer";
import { FinanceiroPanel } from "@/features/financeiro/FinanceiroPanel";
import { FinMetasTab } from "@/features/financeiro/components/FinMetasTab";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_title: z.string().trim().min(2, "Informe seu cargo").max(120),
});
type ProfileValues = z.infer<typeof profileSchema>;

const Index = () => {
  const [tab, setTab] = useState<MainTab>("meu_painel");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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
        if (error) {
          setHasProfile(false);
          return;
        }
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
    if (avatarFile) {
      if (!avatarFile.type.startsWith("image/")) { toast.error("Envie uma imagem (PNG/JPG/WebP)"); return; }
      if (avatarFile.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
      const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
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
    } catch (e: any) { toast.error(e?.message ?? "Erro ao salvar dados públicos do time"); }
    toast.success("Perfil pronto — bora acelerar 🚀");
    setHasProfile(true);
  };

  useEffect(() => {
    if (!avatarFile) { if (avatarPreview) URL.revokeObjectURL(avatarPreview); setAvatarPreview(null); return; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarFile]);

  const renderPanel = () => {
    switch (tab) {
      case "admin": return isAdmin ? <AdminContainer /> : <MeuPainelPanel />;
      case "financeiro": return isAdmin ? <FinanceiroPanel /> : <MeuPainelPanel />;
      case "metas": return isAdmin ? <FinMetasTab /> : <MeuPainelPanel />;
      case "visao_do_dia": return <DayViewPanel />;
      case "desempenho": return <PerformancePanel />;
      case "magic2": return <Magic2Panel />;
      case "criacao": return <GestaoPanel initialClientId={selectedClientId} />;
      case "meu_painel":
      default: return <MeuPainelPanel />;
    }
  };

  return (
    <UauSidebarShell
      tab={tab}
      isAdmin={isAdmin}
      selectedClientId={selectedClientId}
      onSelectClient={(id) => setSelectedClientId(id)}
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
      {hasProfile === false ? (
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
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={avatarPreview ?? undefined} alt="Foto do perfil" />
                    <AvatarFallback>{initials(form.watch("full_name") || "?")}</AvatarFallback>
                  </Avatar>
                  <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                </div>
                <p className="text-xs text-muted-foreground">PNG/JPG/WebP • até 5MB</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome</Label>
                <Input id="full_name" placeholder="Seu nome" {...form.register("full_name")} />
                {form.formState.errors.full_name && <p className="text-sm text-danger">{form.formState.errors.full_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role_title">Cargo</Label>
                <Input id="role_title" placeholder="Ex.: Designer" {...form.register("role_title")} />
                {form.formState.errors.role_title && <p className="text-sm text-danger">{form.formState.errors.role_title.message}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="hero">Entrar no painel</Button>
            </CardFooter>
          </form>
        </Card>
      ) : renderPanel()}
    </UauSidebarShell>
  );
};

export default Index;
