import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Palette, Type, LayoutGrid, Save, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface PdfSettings {
  id: string;
  background_color: string;
  background_image_url: string | null;
  cover_logo_url: string | null;
  title_font_size: number;
  title_color: string;
  subtitle_font_size: number;
  subtitle_color: string;
  card_proportion: string;
  card_font_size: number;
  card_date_font_size: number;
  card_caption_font_size: number;
  show_caption_on_card: boolean;
  show_time_on_card: boolean;
  accent_color: string;
}

function usePdfSettings() {
  return useQuery<PdfSettings>({
    queryKey: ["pm_pdf_settings"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_pdf_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });
}

function useUpdatePdfSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<PdfSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await sb.from("pm_pdf_settings").update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_pdf_settings"] });
      toast.success("Layout salvo!");
    },
  });
}

/* PDF dimensions */
const PDF_W = 1920;
const PDF_H = 1080;

function getCardAspect(proportion: string) {
  if (proportion === "portrait") return 4 / 5;
  if (proportion === "landscape") return 16 / 9;
  return 1;
}

/** Scale-aware PDF page preview */
function PdfPagePreview({ form, type }: { form: Partial<PdfSettings>; type: "cover" | "posts" }) {
  const scale = 1; // rendered at natural size, parent scales via CSS
  const accent = form.accent_color ?? "#7C5CFF";
  const bg = form.background_color ?? "#0B0D12";

  if (type === "cover") {
    return (
      <div
        className="relative overflow-hidden"
        style={{
          width: PDF_W,
          height: PDF_H,
          backgroundColor: bg,
          backgroundImage: form.background_image_url ? `url(${form.background_image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {form.background_image_url && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6">
          {form.cover_logo_url && (
            <img src={form.cover_logo_url} alt="Logo" className="h-[120px] object-contain" />
          )}
          <div style={{ fontSize: (form.title_font_size ?? 32) * 2.5, color: form.title_color ?? "#FFFFFF" }} className="font-bold leading-tight text-center px-12">
            Nome do Cliente
          </div>
          <div style={{ fontSize: (form.subtitle_font_size ?? 18) * 2, color: form.subtitle_color ?? "#AAAAAA" }} className="text-center">
            Cronograma — Março 2026
          </div>
          <div className="h-2 w-40 rounded-full" style={{ backgroundColor: accent }} />
        </div>
      </div>
    );
  }

  // Posts page — show a grid of post cards
  const cardAspect = getCardAspect(form.card_proportion ?? "square");
  const cols = 3;
  const rows = 2;
  const gap = 40;
  const padding = 60;
  const headerH = 100;
  const availW = PDF_W - padding * 2 - gap * (cols - 1);
  const cardW = availW / cols;
  const imageH = cardW / cardAspect;
  const textBlockH = 120;
  const cardH = imageH + textBlockH;

  const cards = Array.from({ length: cols * rows }, (_, i) => i);

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-16" style={{ height: headerH }}>
        <div style={{ fontSize: 36, color: form.title_color ?? "#FFF" }} className="font-bold">Semana 1</div>
        <div className="h-1 flex-1 mx-8 rounded-full" style={{ backgroundColor: accent, opacity: 0.4 }} />
        <div style={{ fontSize: 24, color: form.subtitle_color ?? "#AAA" }}>Março 2026</div>
      </div>

      {/* Cards grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cardW}px)`,
          gap,
          padding: `0 ${padding}px`,
        }}
      >
        {cards.map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#1a1d27", width: cardW }}>
            {/* Image placeholder */}
            <div
              className="flex items-center justify-center"
              style={{ height: imageH, backgroundColor: "#252830" }}
            >
              <LayoutGrid className="h-12 w-12" style={{ color: "#3a3d48" }} />
            </div>
            {/* Text block */}
            <div className="p-4 space-y-1.5">
              <p style={{ fontSize: form.card_font_size ?? 14, color: "#FFF" }} className="font-bold leading-tight">
                Título da postagem {i + 1}
              </p>
              {(form.show_time_on_card ?? true) && (
                <p style={{ fontSize: form.card_date_font_size ?? 12, color: accent }}>
                  📅 {String(7 + i * 3).padStart(2, "0")}/03 às 18:00
                </p>
              )}
              {(form.show_caption_on_card ?? true) && (
                <p style={{ fontSize: form.card_caption_font_size ?? 11, color: "#999" }} className="line-clamp-2">
                  Essa é a legenda da postagem que aparecerá no card do PDF do cronograma...
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PdfLayoutEditor() {
  const settingsQ = usePdfSettings();
  const updateSettings = useUpdatePdfSettings();
  const [form, setForm] = useState<Partial<PdfSettings>>({});
  const [uploading, setUploading] = useState(false);
  const [previewPage, setPreviewPage] = useState<"cover" | "posts">("cover");

  useEffect(() => {
    if (settingsQ.data) {
      setForm(settingsQ.data);
    }
  }, [settingsQ.data]);

  const handleSave = () => {
    if (!form.id) return;
    updateSettings.mutate(form as PdfSettings);
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `pdf-layouts/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
      setForm(prev => ({ ...prev, background_image_url: data.publicUrl }));
      toast.success("Imagem carregada!");
    } catch {
      toast.error("Erro ao carregar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `pdf-layouts/logo-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
      setForm(prev => ({ ...prev, cover_logo_url: data.publicUrl }));
      toast.success("Logo carregado!");
    } catch {
      toast.error("Erro ao carregar logo");
    } finally {
      setUploading(false);
    }
  };

  if (settingsQ.isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Layout do PDF</h3>
          <p className="text-xs text-muted-foreground">Configure o design padrão para todos os cronogramas em PDF. Tamanho: 1920×1080px</p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>

      {/* PDF Preview — full width, scaled to fit */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold">Pré-visualização</h4>
          <span className="text-[10px] text-muted-foreground">({PDF_W}×{PDF_H}px)</span>
          <div className="ml-auto flex gap-1">
            <Button
              variant={previewPage === "cover" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg"
              onClick={() => setPreviewPage("cover")}
            >
              Capa
            </Button>
            <Button
              variant={previewPage === "posts" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs rounded-lg"
              onClick={() => setPreviewPage("posts")}
            >
              Postagens
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 overflow-hidden bg-black/20">
          <div
            className="origin-top-left"
            style={{
              width: PDF_W,
              height: PDF_H,
              transform: `scale(${1})`,
              containerType: "inline-size",
            }}
            ref={(el) => {
              if (!el) return;
              const parent = el.parentElement;
              if (!parent) return;
              const parentW = parent.clientWidth;
              const s = parentW / PDF_W;
              el.style.transform = `scale(${s})`;
              el.style.transformOrigin = "top left";
              parent.style.height = `${PDF_H * s}px`;
            }}
          >
            <PdfPagePreview form={form} type={previewPage} />
          </div>
        </div>
      </div>

      {/* Settings controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Background */}
        <div className="rounded-2xl border border-border/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold">Fundo da Capa</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Cor de fundo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.background_color ?? "#0B0D12"}
                  onChange={e => setForm(prev => ({ ...prev, background_color: e.target.value }))}
                  className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer"
                />
                <Input
                  value={form.background_color ?? ""}
                  onChange={e => setForm(prev => ({ ...prev, background_color: e.target.value }))}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Cor de destaque</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.accent_color ?? "#7C5CFF"}
                  onChange={e => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer"
                />
                <Input
                  value={form.accent_color ?? ""}
                  onChange={e => setForm(prev => ({ ...prev, accent_color: e.target.value }))}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">Imagem de fundo (opcional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Enviando..." : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadBg} disabled={uploading} />
              </label>
              {form.background_image_url && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm(prev => ({ ...prev, background_image_url: null }))}>
                  Remover
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label className="text-[10px] text-muted-foreground">Logo da capa (opcional)</Label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Enviando..." : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} disabled={uploading} />
              </label>
              {form.cover_logo_url && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm(prev => ({ ...prev, cover_logo_url: null }))}>
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="rounded-2xl border border-border/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold">Tipografia</h4>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Título — tamanho</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  value={[form.title_font_size ?? 32]}
                  onValueChange={([v]) => setForm(prev => ({ ...prev, title_font_size: v }))}
                  min={16} max={56} step={2}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8 text-right">{form.title_font_size ?? 32}</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Cor do título</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.title_color ?? "#FFFFFF"}
                  onChange={e => setForm(prev => ({ ...prev, title_color: e.target.value }))}
                  className="h-7 w-7 rounded border border-border/30 cursor-pointer"
                />
                <Input value={form.title_color ?? ""} onChange={e => setForm(prev => ({ ...prev, title_color: e.target.value }))} className="h-7 text-xs flex-1" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Subtítulo — tamanho</Label>
              <div className="flex items-center gap-2 mt-1">
                <Slider
                  value={[form.subtitle_font_size ?? 18]}
                  onValueChange={([v]) => setForm(prev => ({ ...prev, subtitle_font_size: v }))}
                  min={10} max={32} step={1}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8 text-right">{form.subtitle_font_size ?? 18}</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Cor do subtítulo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.subtitle_color ?? "#AAAAAA"}
                  onChange={e => setForm(prev => ({ ...prev, subtitle_color: e.target.value }))}
                  className="h-7 w-7 rounded border border-border/30 cursor-pointer"
                />
                <Input value={form.subtitle_color ?? ""} onChange={e => setForm(prev => ({ ...prev, subtitle_color: e.target.value }))} className="h-7 text-xs flex-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="rounded-2xl border border-border/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold">Cards de Postagem</h4>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Proporção dos cards</Label>
            <Select value={form.card_proportion ?? "square"} onValueChange={v => setForm(prev => ({ ...prev, card_proportion: v }))}>
              <SelectTrigger className="h-8 text-xs rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="square">Quadrado (1:1)</SelectItem>
                <SelectItem value="portrait">Retrato (4:5)</SelectItem>
                <SelectItem value="landscape">Paisagem (16:9)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fonte título</Label>
              <div className="flex items-center gap-1 mt-1">
                <Slider value={[form.card_font_size ?? 14]} onValueChange={([v]) => setForm(prev => ({ ...prev, card_font_size: v }))} min={10} max={24} step={1} className="flex-1" />
                <span className="text-[10px] font-mono w-5">{form.card_font_size ?? 14}</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Fonte data</Label>
              <div className="flex items-center gap-1 mt-1">
                <Slider value={[form.card_date_font_size ?? 12]} onValueChange={([v]) => setForm(prev => ({ ...prev, card_date_font_size: v }))} min={8} max={20} step={1} className="flex-1" />
                <span className="text-[10px] font-mono w-5">{form.card_date_font_size ?? 12}</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Fonte legenda</Label>
              <div className="flex items-center gap-1 mt-1">
                <Slider value={[form.card_caption_font_size ?? 11]} onValueChange={([v]) => setForm(prev => ({ ...prev, card_caption_font_size: v }))} min={8} max={18} step={1} className="flex-1" />
                <span className="text-[10px] font-mono w-5">{form.card_caption_font_size ?? 11}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Switch checked={form.show_caption_on_card ?? true} onCheckedChange={v => setForm(prev => ({ ...prev, show_caption_on_card: v }))} />
              <Label className="text-xs">Mostrar legenda</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm(prev => ({ ...prev, show_time_on_card: v }))} />
              <Label className="text-xs">Mostrar horário</Label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
