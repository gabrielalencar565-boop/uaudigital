import { useEffect, useState } from "react";
import { Save, ImageIcon, Circle, Square } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { toast } from "sonner";

export function AdminBrandingPanel() {
  const { user } = useSession();
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [logoShape, setLogoShape] = useState<"circle" | "square">("square");
  const [workspaceName, setWorkspaceName] = useState("");

  // Sync from backend
  useEffect(() => {
    if (appSettingsQ.data?.logo_shape) {
      setLogoShape(appSettingsQ.data.logo_shape);
    }
    if (appSettingsQ.data?.workspace_name !== undefined) {
      setWorkspaceName(appSettingsQ.data.workspace_name ?? "");
    }
  }, [appSettingsQ.data?.logo_shape, appSettingsQ.data?.workspace_name]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo e nome do app
          </CardTitle>
          <CardDescription>A logo e o nome aparecem no topo da barra superior (visível para todos).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workspace name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Nome do workspace</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                placeholder="Ex.: agencyflow"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingLogo || workspaceName === (appSettingsQ.data?.workspace_name ?? "")}
                onClick={async () => {
                  try {
                    await updateAppSettings.mutateAsync({ workspace_name: workspaceName.trim() });
                    toast.success("Nome atualizado!");
                  } catch (err: any) {
                    toast.error(err?.message ?? "Erro ao atualizar nome");
                  }
                }}
              >
                Salvar nome
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Texto exibido ao lado da logo no topo.</p>
          </div>

          {/* Current logo */}
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

          {/* Upload new logo */}
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
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setLogoFile(file);
                if (file) setLogoPreview(URL.createObjectURL(file));
                else setLogoPreview(null);
              }}
            />
            <p className="text-xs text-muted-foreground">PNG/JPG/SVG/WebP • até 5MB • recomendado PNG com transparência</p>
          </div>

          {/* Logo shape */}
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
        <CardFooter className="flex flex-wrap gap-2">
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
                const newLogoUrl = (pub.data.publicUrl ?? null) + "?t=" + Date.now();

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
    </div>
  );
}
