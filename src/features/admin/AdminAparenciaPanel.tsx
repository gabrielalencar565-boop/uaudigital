import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Plus, Trash2, Settings2, Move, ZoomIn, RotateCcw, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useAppSettings, useUpdateAppSettings, type BgImageConfig } from "@/features/data/queries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AdminAparenciaPanel() {
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const images: BgImageConfig[] = appSettingsQ.data?.login_bg_images ?? [];

  // Local state for the selected image editing
  const selected = selectedIdx !== null ? images[selectedIdx] : null;
  const [localPosX, setLocalPosX] = useState(50);
  const [localPosY, setLocalPosY] = useState(50);
  const [localZoom, setLocalZoom] = useState(1);
  const [localOpacity, setLocalOpacity] = useState(0.2);
  const [dirty, setDirty] = useState(false);

  // Load selected image settings
  useEffect(() => {
    if (selected) {
      setLocalPosX(selected.posX);
      setLocalPosY(selected.posY);
      setLocalZoom(selected.zoom);
      setLocalOpacity(selected.opacity);
      setDirty(false);
    }
  }, [selectedIdx, selected?.url]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setLocalZoom((z) => Math.min(3, Math.max(0.5, z + (e.deltaY > 0 ? -0.05 : 0.05))));
    setDirty(true);
  }, []);

  const handleSaveSelected = async () => {
    if (selectedIdx === null) return;
    const updated = images.map((img, i) =>
      i === selectedIdx
        ? { ...img, posX: Math.round(localPosX), posY: Math.round(localPosY), zoom: Math.round(localZoom * 100) / 100, opacity: Math.round(localOpacity * 100) / 100 }
        : img
    );
    try {
      await updateAppSettings.mutateAsync({ login_bg_images: updated } as any);
      setDirty(false);
      toast.success("Ajustes da imagem salvos!");
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
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      const newImg: BgImageConfig = { url: pub.data.publicUrl, posX: 50, posY: 50, zoom: 1, opacity: 0.2 };
      await updateAppSettings.mutateAsync({ login_bg_images: [...images, newImg] } as any);
      toast.success("Imagem adicionada!");
      setSelectedIdx(images.length); // select the new one
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (idx: number) => {
    try {
      const updated = images.filter((_, i) => i !== idx);
      await updateAppSettings.mutateAsync({ login_bg_images: updated } as any);
      if (selectedIdx === idx) setSelectedIdx(null);
      else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
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
            Clique em uma imagem para ajustar posição, zoom e opacidade individualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img, idx) => (
                <div
                  key={img.url}
                  className={cn(
                    "group relative aspect-video overflow-hidden rounded-lg border-2 cursor-pointer transition-all",
                    selectedIdx === idx
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {selectedIdx === idx && (
                    <div className="absolute left-1 top-1 rounded-full bg-primary p-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                  {/* Mini indicators */}
                  <div className="absolute bottom-1 left-1 flex gap-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white/80 font-mono">
                      {Math.round(img.zoom * 100)}%
                    </span>
                  </div>
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

      {/* Per-image editor */}
      {selected && selectedIdx !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Ajustar imagem {selectedIdx + 1}
            </CardTitle>
            <CardDescription>
              Arraste para reposicionar, scroll para zoom. Ajuste a opacidade pelo slider.
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
                    backgroundImage: `url(${selected.url})`,
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
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-8 w-px bg-white/30" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-px w-8 bg-white/30" />
                </div>
                <div className="absolute bottom-2 left-2 flex gap-2 pointer-events-none">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 font-mono">
                    X:{Math.round(localPosX)}% Y:{Math.round(localPosY)}%
                  </span>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 font-mono">
                    Zoom:{Math.round(localZoom * 100)}%
                  </span>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 font-mono">
                    Opac:{Math.round(localOpacity * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Opacity slider */}
            <div className="space-y-2">
              <Label>Opacidade — {Math.round(localOpacity * 100)}%</Label>
              <Slider
                value={[localOpacity]}
                min={0.05}
                max={1}
                step={0.05}
                onValueChange={(v) => { setLocalOpacity(v[0]); setDirty(true); }}
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">Quanto maior, mais visível a imagem.</p>
            </div>

            {/* Zoom slider */}
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
              <Button onClick={handleSaveSelected} disabled={!dirty} className="gap-2">
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
