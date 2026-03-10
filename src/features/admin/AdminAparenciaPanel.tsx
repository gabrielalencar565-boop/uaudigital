import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Plus, Trash2, Settings2, Move, ZoomIn, RotateCcw } from "lucide-react";
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
  const savedOpacity = appSettingsQ.data?.login_bg_opacity ?? 0.2;
  const savedPosX = appSettingsQ.data?.login_bg_position_x ?? 50;
  const savedPosY = appSettingsQ.data?.login_bg_position_y ?? 50;
  const savedZoom = appSettingsQ.data?.login_bg_zoom ?? 1;

  // Local state for interactive preview
  const [localPosX, setLocalPosX] = useState(savedPosX);
  const [localPosY, setLocalPosY] = useState(savedPosY);
  const [localZoom, setLocalZoom] = useState(savedZoom);
  const [localOpacity, setLocalOpacity] = useState(savedOpacity);
  const [dirty, setDirty] = useState(false);

  // Sync local state when saved values change
  useEffect(() => { setLocalPosX(savedPosX); }, [savedPosX]);
  useEffect(() => { setLocalPosY(savedPosY); }, [savedPosY]);
  useEffect(() => { setLocalZoom(savedZoom); }, [savedZoom]);
  useEffect(() => { setLocalOpacity(savedOpacity); }, [savedOpacity]);

  // Drag state
  const previewRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: localPosX, posY: localPosY };
  }, [localPosX, localPosY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * -100;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * -100;
      setLocalPosX(Math.min(100, Math.max(0, dragStart.current.posX + dx)));
      setLocalPosY(Math.min(100, Math.max(0, dragStart.current.posY + dy)));
      setDirty(true);
    };
    const handleMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Wheel zoom on preview
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setLocalZoom((z) => Math.min(3, Math.max(0.5, z + (e.deltaY > 0 ? -0.05 : 0.05))));
    setDirty(true);
  }, []);

  const handleSaveAll = async () => {
    try {
      await updateAppSettings.mutateAsync({
        login_bg_position_x: Math.round(localPosX),
        login_bg_position_y: Math.round(localPosY),
        login_bg_zoom: Math.round(localZoom * 100) / 100,
        login_bg_opacity: Math.round(localOpacity * 100) / 100,
      } as any);
      setDirty(false);
      toast.success("Ajustes salvos!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const handleReset = () => {
    setLocalPosX(50);
    setLocalPosY(50);
    setLocalZoom(1);
    setLocalOpacity(0.2);
    setDirty(true);
  };

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

      {/* Ajustes interativos */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Ajustes da imagem de fundo
            </CardTitle>
            <CardDescription>
              Arraste a imagem para reposicionar. Use o scroll do mouse para dar zoom. Ajuste a opacidade abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Interactive preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Pré-visualização interativa</Label>
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Move className="h-3 w-3" /> Arraste
                </span>
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <ZoomIn className="h-3 w-3" /> Scroll = Zoom
                </span>
              </div>
              <div
                ref={previewRef}
                className="relative aspect-video w-full max-w-lg cursor-grab overflow-hidden rounded-lg border-2 border-primary/30 bg-black active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onWheel={handleWheel}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `url(${images[0]})`,
                    backgroundSize: "cover",
                    backgroundPosition: `${localPosX}% ${localPosY}%`,
                    transform: `scale(${localZoom})`,
                    transformOrigin: `${localPosX}% ${localPosY}%`,
                    transition: dragging.current ? "none" : "transform 0.2s ease-out",
                  }}
                />
                <div
                  className="absolute inset-0 bg-black pointer-events-none"
                  style={{ opacity: 1 - localOpacity }}
                />
                {/* Center crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-8 w-px bg-white/30" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-px w-8 bg-white/30" />
                </div>
                {/* Info overlay */}
                <div className="absolute bottom-2 left-2 flex gap-2 pointer-events-none">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 font-mono">
                    X:{Math.round(localPosX)}% Y:{Math.round(localPosY)}%
                  </span>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 font-mono">
                    Zoom:{Math.round(localZoom * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Opacity slider */}
            <div className="space-y-2">
              <Label>Opacidade da imagem — {Math.round(localOpacity * 100)}%</Label>
              <Slider
                value={[localOpacity]}
                min={0.05}
                max={1}
                step={0.05}
                onValueChange={(v) => { setLocalOpacity(v[0]); setDirty(true); }}
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">Quanto maior, mais visível a imagem de fundo.</p>
            </div>

            {/* Zoom slider (alternative to scroll) */}
            <div className="space-y-2">
              <Label>Zoom — {Math.round(localZoom * 100)}%</Label>
              <Slider
                value={[localZoom]}
                min={0.5}
                max={3}
                step={0.05}
                onValueChange={(v) => { setLocalZoom(v[0]); setDirty(true); }}
                className="max-w-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleSaveAll} disabled={!dirty} className="gap-2">
                Salvar ajustes
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Resetar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
