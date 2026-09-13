import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { UserRound, Save, Trash2, Plus, Images, Bell, Play, VolumeX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  NOTIFICATION_SOUNDS,
  getCategorySound,
  setCategorySound,
  type SoundCategory,
} from "@/lib/notifications";


import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { toast } from "sonner";
import { WhatsAppPreferencesCard } from "./WhatsAppPreferencesCard";

const settingsSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_title: z.string().trim().min(2, "Informe seu cargo").max(120),
  birth_date: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function ConfiguracoesPanel() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole(user?.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { full_name: "", role_title: "", birth_date: "" },
  });

  // carregar dados atuais
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("full_name, role_title, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoading(false);
          return;
        }
        // Also fetch birth_date from team_members
        supabase
          .from("team_members")
          .select("birth_date")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data: tmData }) => {
            if (cancelled) return;
            if (data) {
              form.reset({
                full_name: data.full_name ?? "",
                role_title: data.role_title ?? "",
                birth_date: (tmData as any)?.birth_date ?? "",
              });
              setAvatarUrl(normalizeAvatarUrl(data.avatar_url) ?? null);
            }
            setLoading(false);
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // preview local
  useEffect(() => {
    if (!avatarFile) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarFile]);

  const displayName = useMemo(() => form.watch("full_name") || "?", [form]);

  const onSave = async (v: SettingsValues) => {
    if (!user) return;
    setSaving(true);
    try {
      // upload avatar (opcional)
      let nextAvatarUrl = avatarUrl;
      if (avatarFile) {
        if (!avatarFile.type.startsWith("image/")) throw new Error("Envie uma imagem (PNG/JPG/WebP)");
        if (avatarFile.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx 5MB)");

        const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("avatars").upload(path, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });
        if (up.error) throw up.error;

        const pub = supabase.storage.from("avatars").getPublicUrl(path);
        nextAvatarUrl = pub.data.publicUrl ?? null;
      }

      // atualizar perfil (privado)
      const prof = await supabase
        .from("profiles")
        .update({ full_name: v.full_name, role_title: v.role_title, avatar_url: nextAvatarUrl })
        .eq("user_id", user.id);
      if (prof.error) throw prof.error;

      // atualizar/criar membro do time (público para o app)
      // (update sozinho pode não alterar nada se a linha não existir)
      const tm = await supabase
        .from("team_members")
        .upsert(
          {
            user_id: user.id,
            display_name: v.full_name,
            role_title: v.role_title,
            avatar_url: nextAvatarUrl,
            is_active: true,
            birth_date: v.birth_date || null,
          } as any,
          { onConflict: "user_id" },
        );
      if (tm.error) throw tm.error;

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      // Invalidar todos os caches que consomem dados de avatar
      queryClient.invalidateQueries({ queryKey: ["my_profile"] });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="opacity-0"
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}
      >
        <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
        <p className="text-sm text-muted-foreground">Edite seu nome, cargo e foto.</p>
      </div>

      <Card
        className={`opacity-0 ${loading ? "opacity-80" : ""}`}
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            Meu perfil
          </CardTitle>
          <CardDescription>Essas informações aparecem na Agenda e nos rankings.</CardDescription>
        </CardHeader>

        <form onSubmit={form.handleSubmit(onSave)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview ?? avatarUrl ?? undefined} alt="Foto do perfil" />
                  <AvatarFallback>{initials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground">PNG/JPG/WebP • até 5MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Nome</Label>
              <Input id="full_name" placeholder="Seu nome" {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <p className="text-sm text-danger">{form.formState.errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_title">Cargo</Label>
              <Input id="role_title" placeholder="Ex.: Editor" {...form.register("role_title")} />
              {form.formState.errors.role_title && (
                <p className="text-sm text-danger">{form.formState.errors.role_title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de nascimento</Label>
              <DatePicker value={form.watch("birth_date") ?? ""} onChange={(v) => form.setValue("birth_date", v)} className="w-full" />
              <p className="text-xs text-muted-foreground">Sua data de aniversário aparecerá no calendário e você receberá parabéns no dia.</p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" variant="brand" className="gap-2" disabled={saving || loading}>
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <NotificationSoundsCard />

      <WhatsAppPreferencesCard />

      {isAdmin ? (
        <LoginBgImagesCard />
      ) : null}

    </div>
  );
}

/* ── Login Background Images Card ── */
function LoginBgImagesCard() {
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);

  const images = appSettingsQ.data?.login_bg_images ?? [];

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `login-bg/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      const url = pub.data.publicUrl;
      const newImg = { url, posX: 50, posY: 50, zoom: 1, opacity: 0.2 };
      await updateAppSettings.mutateAsync({ login_bg_images: [...images, newImg] } as any);
      toast.success("Imagem adicionada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (url: string) => {
    try {
      await updateAppSettings.mutateAsync({ login_bg_images: images.filter((u) => u.url !== url) } as any);
      toast.success("Imagem removida");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  };

  return (
    <Card
      className="opacity-0"
      style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.45s" }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Images className="h-5 w-5" />
          Imagens de fundo do login
        </CardTitle>
        <CardDescription>
          As imagens passam em slideshow no fundo da tela de login com opacidade baixa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => (
              <div key={img.url} className="group relative aspect-video overflow-hidden rounded-lg border border-border">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => handleRemove(img.url)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma imagem adicionada. O fundo ficará com a cor padrão.</p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.multiple = true;
              input.onchange = async () => {
                const files = Array.from(input.files ?? []);
                for (const f of files) await handleUpload(f);
              };
              input.click();
            }}
          >
            <Plus className="h-4 w-4" />
            {uploading ? "Enviando..." : "Adicionar imagens"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Notification Sounds Card ── */
function SoundRow({
  category,
  title,
  description,
}: {
  category: SoundCategory;
  title: string;
  description: string;
}) {
  const [value, setValue] = useState<string>(() => getCategorySound(category));

  const handleChange = (next: string) => {
    setValue(next);
    setCategorySound(category, next);
    if (next !== "off") {
      const s = NOTIFICATION_SOUNDS.find((x) => x.id === next);
      s?.play();
    }
    toast.success("Preferência salva");
  };

  const handlePreview = () => {
    if (value === "off") return;
    const s = NOTIFICATION_SOUNDS.find((x) => x.id === value);
    s?.play();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Som" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">
              <span className="flex items-center gap-2">
                <VolumeX className="h-3.5 w-3.5" /> Desligado
              </span>
            </SelectItem>
            {NOTIFICATION_SOUNDS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={value === "off"}
          onClick={handlePreview}
          title="Tocar"
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NotificationSoundsCard() {
  return (
    <Card
      className="opacity-0"
      style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.4s" }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Sons de notificação
        </CardTitle>
        <CardDescription>
          Escolha um som diferente para cada tipo de notificação ou desligue por categoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SoundRow
          category="chat"
          title="Mensagens do chat"
          description="Tocado quando você recebe uma mensagem privada ou no chat geral."
        />
        <SoundRow
          category="task"
          title="Tarefas e menções"
          description="Atribuição, prazos vencendo, tarefas atrasadas e menções em comentários."
        />
      </CardContent>
    </Card>
  );
}
