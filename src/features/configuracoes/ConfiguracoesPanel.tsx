import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { UserRound, Save, ImageIcon, Circle, Square, Trash2, Plus, Images } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { toast } from "sonner";

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
  const { isAdmin } = useRole(user?.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [logoShape, setLogoShape] = useState<"circle" | "square">("square");

  // Sync logo shape from backend
  useEffect(() => {
    if (appSettingsQ.data?.logo_shape) {
      setLogoShape(appSettingsQ.data.logo_shape);
    }
  }, [appSettingsQ.data?.logo_shape]);

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
              setAvatarUrl(data.avatar_url ?? null);
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

      {isAdmin ? (
        <Card
          className="opacity-0"
          style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.3s" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo do app
            </CardTitle>
            <CardDescription>A logo aparece no topo da sidebar (visível para todos).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Nome do workspace</Label>
              <Input
                id="workspace-name"
                placeholder="Ex.: agencyflow"
                defaultValue={appSettingsQ.data?.workspace_name ?? ""}
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  if (val !== (appSettingsQ.data?.workspace_name ?? "")) {
                    try {
                      await updateAppSettings.mutateAsync({ workspace_name: val });
                      toast.success("Nome atualizado!");
                    } catch (err: any) {
                      toast.error(err?.message ?? "Erro ao atualizar nome");
                    }
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Texto exibido ao lado da logo no topo.</p>
            </div>

            <div className="space-y-2">
              <Label>Logo atual</Label>
              {appSettingsQ.data?.logo_url ? (
                <div className="flex items-start gap-3">
                  <img
                    src={appSettingsQ.data.logo_url}
                    alt="Logo do app"
                    className="h-16 w-16 rounded-md border border-border object-contain"
                  />
                  <p className="text-sm text-muted-foreground">Logo salva.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma logo definida (fallback será exibido).</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-logo">Nova logo</Label>
              {logoPreview ? (
                <div className="mb-2 flex items-start gap-3">
                  <img
                    src={logoPreview}
                    alt="Pré-visualização"
                    className="h-16 w-16 rounded-md border border-border object-contain"
                  />
                  <p className="text-sm text-muted-foreground">Pré-visualização da nova logo.</p>
                </div>
              ) : null}
              <Input
                id="app-logo"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setLogoFile(file);
                  if (file) setLogoPreview(URL.createObjectURL(file));
                  else setLogoPreview(null);
                }}
              />
              <p className="text-xs text-muted-foreground">PNG/JPG/SVG • até 5MB</p>
            </div>

            <div className="space-y-2">
              <Label>Formato da logo</Label>
              <RadioGroup
                value={logoShape}
                onValueChange={(v) => setLogoShape(v as "circle" | "square")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="square" id="shape-square" />
                  <Label htmlFor="shape-square" className="flex cursor-pointer items-center gap-2 font-normal">
                    <Square className="h-4 w-4" />
                    Quadrado
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="circle" id="shape-circle" />
                  <Label htmlFor="shape-circle" className="flex cursor-pointer items-center gap-2 font-normal">
                    <Circle className="h-4 w-4" />
                    Círculo
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              disabled={!logoFile || savingLogo}
              onClick={async () => {
                if (!logoFile || !user) return;
                setSavingLogo(true);
                try {
                  if (!logoFile.type.startsWith("image/")) throw new Error("Envie uma imagem (PNG/JPG/SVG)");
                  if (logoFile.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx 5MB)");

                  const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
                  const path = `logo.${ext}`;
                  const up = await supabase.storage.from("app-assets").upload(path, logoFile, {
                    upsert: true,
                    contentType: logoFile.type,
                  });
                  if (up.error) throw up.error;

                  const pub = supabase.storage.from("app-assets").getPublicUrl(path);
                  const newLogoUrl = pub.data.publicUrl ?? null;

                  await updateAppSettings.mutateAsync({ logo_url: newLogoUrl, logo_shape: logoShape });
                  setLogoFile(null);
                  setLogoPreview(null);
                  toast.success("Logo atualizada!");
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao salvar logo");
                } finally {
                  setSavingLogo(false);
                }
              }}
            >
              <Save className="h-4 w-4" />
              {savingLogo ? "Salvando..." : "Salvar logo"}
            </Button>
            {appSettingsQ.data?.logo_shape !== logoShape && !logoFile ? (
              <Button
                type="button"
                variant="outline"
                disabled={savingLogo}
                onClick={async () => {
                  setSavingLogo(true);
                  try {
                    await updateAppSettings.mutateAsync({ logo_shape: logoShape });
                    toast.success("Formato atualizado!");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Erro ao atualizar formato");
                  } finally {
                    setSavingLogo(false);
                  }
                }}
              >
                Aplicar formato
              </Button>
            ) : null}
            {appSettingsQ.data?.logo_url ? (
              <Button
                type="button"
                variant="outline"
                disabled={savingLogo}
                onClick={async () => {
                  const ok = window.confirm("Tem certeza que deseja remover a logo? Será exibido o fallback.");
                  if (!ok) return;
                  setSavingLogo(true);
                  try {
                    await updateAppSettings.mutateAsync({ logo_url: null });
                    toast.success("Logo removida");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Erro ao remover logo");
                  } finally {
                    setSavingLogo(false);
                  }
                }}
              >
                Remover logo
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : null}

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
