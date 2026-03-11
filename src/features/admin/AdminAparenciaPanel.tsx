import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/* ── Mini masonry preview (matches Auth login layout) ── */
function MiniMasonryPreview({ images, selectedIdx, onSelect }: {
  images: BgImageConfig[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const urls = images.map((img) => img.url);

  const cols = useMemo(() => {
    if (urls.length === 0) return [[], [], []];
    const col1: { url: string; idx: number }[] = [];
    const col2: { url: string; idx: number }[] = [];
    const col3: { url: string; idx: number }[] = [];
    const minItems = Math.max(6, urls.length);
    for (let i = 0; i < minItems; i++) {
      const realIdx = i % urls.length;
      const item = { url: urls[realIdx], idx: realIdx };
      if (i % 3 === 0) col1.push(item);
      else if (i % 3 === 1) col2.push(item);
      else col3.push(item);
    }
    return [col1, col2, col3];
  }, [urls]);

  if (urls.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">Nenhuma imagem adicionada</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-border bg-[#0B0B0B]" style={{ height: 340 }}>
      {/* Simulated login left panel */}
      <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center" style={{ width: "38%", background: "#0B0B0B", zIndex: 2 }}>
        <div className="space-y-2 text-center px-4">
          <div className="mx-auto h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary-foreground">U</span>
          </div>
          <p className="text-[9px] font-semibold text-white/80">Bem-vindo de volta</p>
          <div className="mx-auto space-y-1.5 w-24">
            <div className="h-3 rounded bg-white/10" />
            <div className="h-3 rounded bg-white/10" />
            <div className="h-4 rounded bg-primary/60" />
          </div>
        </div>
      </div>
      {/* Masonry gallery */}
      <div className="absolute right-0 top-0 bottom-0 flex gap-1.5 overflow-hidden p-2" style={{ left: "38%" }}>
        {cols.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-1 flex-col gap-1.5">
            {col.map((item, i) => {
              const isSelected = selectedIdx === item.idx;
              return (
                <div
                  key={`${colIdx}-${i}`}
                  className={cn(
                    "relative overflow-hidden rounded-lg cursor-pointer transition-all border-2",
                    isSelected ? "border-primary ring-1 ring-primary/40" : "border-transparent hover:border-white/30"
                  )}
                  style={{
                    aspectRatio: colIdx === 1 && i % 3 === 0 ? "3/4" : i % 2 === 0 ? "4/5" : "3/4",
                  }}
                  onClick={() => onSelect(isSelected ? null : item.idx)}
                >
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.4) 100%)" }}
                  />
                  {isSelected && (
                    <div className="absolute left-1 top-1 rounded-full bg-primary p-0.5">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAparenciaPanel() {
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const { user } = useSession();
  const [uploading, setUploading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const images: BgImageConfig[] = appSettingsQ.data?.login_bg_images ?? [];

  const selected = selectedIdx !== null ? images[selectedIdx] : null;
  const [localPosX, setLocalPosX] = useState(50);
  const [localPosY, setLocalPosY] = useState(50);
  const [localZoom, setLocalZoom] = useState(1);
  const [localOpacity, setLocalOpacity] = useState(0.2);
  const [dirty, setDirty] = useState(false);

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
      setSelectedIdx(images.length);
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

  /* ── Logo do Login ── */
  const logoUrl = appSettingsQ.data?.logo_url ?? null;
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploadingLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `logo/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      await updateAppSettings.mutateAsync({ logo_url: pub.data.publicUrl } as any);
      toast.success("Logo do login atualizada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateAppSettings.mutateAsync({ logo_url: null } as any);
      toast.success("Logo do login removida");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover logo");
    }
  };

  /* ── Logo da Sidebar ── */
  const sidebarLogoUrl = appSettingsQ.data?.sidebar_logo_url ?? null;
  const [uploadingSidebarLogo, setUploadingSidebarLogo] = useState(false);

  const handleSidebarLogoUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }
    setUploadingSidebarLogo(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `sidebar-logo/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      await updateAppSettings.mutateAsync({ sidebar_logo_url: pub.data.publicUrl } as any);
      toast.success("Logo da sidebar atualizada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar logo");
    } finally {
      setUploadingSidebarLogo(false);
    }
  };

  const handleRemoveSidebarLogo = async () => {
    try {
      await updateAppSettings.mutateAsync({ sidebar_logo_url: null } as any);
      toast.success("Logo da sidebar removida");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover logo");
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo do Login */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Logo do Login
          </CardTitle>
          <CardDescription>
            Aparece na tela de login. Use preferencialmente uma imagem com fundo transparente (PNG).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo login" className="max-h-20 max-w-[180px] object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem logo</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={uploadingLogo}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async () => {
                  const f = input.files?.[0];
                  if (f) await handleLogoUpload(f);
                };
                input.click();
              }}
            >
              <Plus className="h-4 w-4" />
              {uploadingLogo ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
            </Button>
            {logoUrl && (
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleRemoveLogo}>
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logo da Sidebar / Barra Superior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Logo da Barra Superior
          </CardTitle>
          <CardDescription>
            Aparece no topo da aplicação (sidebar). Pode ser diferente da logo do login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
              {sidebarLogoUrl ? (
                <img src={sidebarLogoUrl} alt="Logo sidebar" className="max-h-20 max-w-[180px] object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sem logo</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={uploadingSidebarLogo}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async () => {
                  const f = input.files?.[0];
                  if (f) await handleSidebarLogoUpload(f);
                };
                input.click();
              }}
            >
              <Plus className="h-4 w-4" />
              {uploadingSidebarLogo ? "Enviando..." : sidebarLogoUrl ? "Trocar logo" : "Enviar logo"}
            </Button>
            {sidebarLogoUrl && (
              <Button variant="destructive" size="sm" className="gap-2" onClick={handleRemoveSidebarLogo}>
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Preview masonry — replica do login */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Preview da tela de login
          </CardTitle>
          <CardDescription>
            Clique em uma foto na galeria para editá-la. Este preview simula o layout real do login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MiniMasonryPreview images={images} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />

          <div className="flex flex-wrap gap-2">
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

            {selectedIdx !== null && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => handleRemove(selectedIdx)}
              >
                <Trash2 className="h-4 w-4" />
                Remover selecionada
              </Button>
            )}
          </div>
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
            {/* Interactive preview — uses card aspect ratio from masonry */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Pré-visualização no card</Label>
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Move className="h-3 w-3" /> Arraste
                </span>
                <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <ZoomIn className="h-3 w-3" /> Scroll = Zoom
                </span>
              </div>
              <div
                ref={previewRef}
                className="relative w-full max-w-xs cursor-grab overflow-hidden rounded-2xl border-2 border-primary/30 bg-black active:cursor-grabbing select-none"
                style={{ aspectRatio: "3/4" }}
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
