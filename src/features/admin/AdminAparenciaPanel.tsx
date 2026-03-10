import { useState } from "react";
import { Images, Plus, Trash2, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const objectFit = appSettingsQ.data?.login_bg_object_fit ?? "cover";
  const opacity = appSettingsQ.data?.login_bg_opacity ?? 0.2;

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

  const handleObjectFitChange = async (value: string) => {
    try {
      await updateAppSettings.mutateAsync({ login_bg_object_fit: value } as any);
      toast.success("Modo de exibição atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const handleOpacityChange = async (value: number[]) => {
    try {
      await updateAppSettings.mutateAsync({ login_bg_opacity: value[0] } as any);
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
              Nenhuma imagem adicionada. O fundo da tela de login ficará com a cor padrão.
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

      {/* Dimensões e opacidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações da imagem de fundo
          </CardTitle>
          <CardDescription>
            Ajuste como as imagens são exibidas e a opacidade na tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Modo de exibição</Label>
            <Select value={objectFit} onValueChange={handleObjectFitChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cobrir (preenche toda a tela, pode cortar)</SelectItem>
                <SelectItem value="contain">Conter (mostra a imagem inteira, pode ter barras)</SelectItem>
                <SelectItem value="fill">Esticar (distorce para preencher)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define como a imagem se ajusta à tela.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Opacidade da imagem — {Math.round(opacity * 100)}%</Label>
            <Slider
              value={[opacity]}
              min={0.05}
              max={1}
              step={0.05}
              onValueCommit={handleOpacityChange}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Quanto maior, mais visível a imagem de fundo. O overlay escuro será ajustado automaticamente.
            </p>
          </div>

          {/* Preview */}
          {images.length > 0 && (
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border border-border">
                <img
                  src={images[0]}
                  alt="Preview"
                  className="h-full w-full"
                  style={{ objectFit: objectFit as any }}
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
