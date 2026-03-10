import { useState } from "react";
import { Images, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      <Card>
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
    </div>
  );
}
