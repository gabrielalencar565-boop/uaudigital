import { useState } from "react";
import { Images, Plus, Trash2, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { toast } from "sonner";

export function AdminAparenciaPanel() {
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);

  const images: string[] = appSettingsQ.data?.login_bg_images ?? [];
  const opacity = appSettingsQ.data?.login_bg_opacity ?? 0.2;
  const posX = appSettingsQ.data?.login_bg_position_x ?? 50;
  const posY = appSettingsQ.data?.login_bg_position_y ?? 50;
  const zoom = appSettingsQ.data?.login_bg_zoom ?? 1;

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `login-bg/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      const url = pub.data.publicUrl;
      await updateAppSettings.mutateAsync({ login_bg_images: [...images, url] } as any);
      toast.success("Imagem adicionada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (url: string) => {
    try {
      await updateAppSettings.mutateAsync({ login_bg_images: images.filter((u) => u !== url) } as any);
      toast.success("Imagem removida");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  };

  const save = async (field: string, value: number) => {
    try {
      await updateAppSettings.mutateAsync({ [field]: value } as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-6">
      {/* Imagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Imagens de fundo do login
          </CardTitle>
          <CardDescription>
            As imagens passam em slideshow no fundo da tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((url) => (
                <div
                  key={url}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => handleRemove(url)}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma imagem adicionada. O fundo ficará com a cor padrão.
            </p>
          )}

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
        </CardContent>
      </Card>

      {/* Ajustes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Ajustes da imagem de fundo
          </CardTitle>
          <CardDescription>
            Posicione, dê zoom e controle a opacidade da imagem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Posição horizontal */}
          <div className="space-y-2">
            <Label>Posição horizontal — {posX}%</Label>
            <Slider
              value={[posX]}
              min={0}
              max={100}
              step={1}
              onValueCommit={(v) => save("login_bg_position_x", v[0])}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">0% = esquerda, 50% = centro, 100% = direita</p>
          </div>

          {/* Posição vertical */}
          <div className="space-y-2">
            <Label>Posição vertical — {posY}%</Label>
            <Slider
              value={[posY]}
              min={0}
              max={100}
              step={1}
              onValueCommit={(v) => save("login_bg_position_y", v[0])}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">0% = topo, 50% = centro, 100% = embaixo</p>
          </div>

          {/* Zoom */}
          <div className="space-y-2">
            <Label>Zoom — {Math.round(zoom * 100)}%</Label>
            <Slider
              value={[zoom]}
              min={0.5}
              max={3}
              step={0.05}
              onValueCommit={(v) => save("login_bg_zoom", v[0])}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">50% = afastado, 100% = normal, 300% = bem próximo</p>
          </div>

          {/* Opacidade */}
          <div className="space-y-2">
            <Label>Opacidade da imagem — {Math.round(opacity * 100)}%</Label>
            <Slider
              value={[opacity]}
              min={0.05}
              max={1}
              step={0.05}
              onValueCommit={(v) => save("login_bg_opacity", v[0])}
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">Quanto maior, mais visível a imagem.</p>
          </div>

          {/* Preview */}
          {images.length > 0 && (
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-border bg-black">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${images[0]})`,
                    backgroundSize: "cover",
                    backgroundPosition: `${posX}% ${posY}%`,
                    transform: `scale(${zoom})`,
                    transformOrigin: `${posX}% ${posY}%`,
                  }}
                />
                <div
                  className="absolute inset-0 bg-black"
                  style={{ opacity: 1 - opacity }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-medium text-white/80">Preview do fundo</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
