import { useState } from "react";
import {
  SlidersHorizontal, Palette, Type, ImageIcon, LayoutTemplate,
  ChevronRight, Sparkles, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BlockId, PdfSettings } from "./types";
import { BLOCK_META } from "./types";
import { uploadPdfAsset } from "./use-pdf-settings";
import { toast } from "sonner";
import { PDF_TEMPLATES, type PdfTemplate } from "./pdf-templates";

interface Props {
  form: Partial<PdfSettings>;
  setForm: React.Dispatch<React.SetStateAction<Partial<PdfSettings>>>;
  selectedBlock: BlockId;
  onResetBlockLayout: () => void;
}

type RightTab = "properties" | "templates";

export function PropertiesPanel({ form, setForm, selectedBlock, onResetBlockLayout }: Props) {
  const [tab, setTab] = useState<RightTab>("properties");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, prefix: string, key: keyof PdfSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPdfAsset(file, prefix);
      setForm(p => ({ ...p, [key]: url }));
      toast.success("Imagem carregada!");
    } catch {
      toast.error("Erro ao carregar imagem");
    } finally {
      setUploading(false);
    }
  };

  const applyTemplate = (template: PdfTemplate) => {
    setForm(prev => ({
      ...prev,
      ...template.settings,
      // Preserve identity & structure
      id: prev.id,
      blocks_order: prev.blocks_order,
      blocks_enabled: prev.blocks_enabled,
      layout_overrides: prev.layout_overrides,
      agency_name: prev.agency_name,
      agency_logo_url: prev.agency_logo_url,
      cover_logo_url: prev.cover_logo_url,
      background_image_url: prev.background_image_url,
      footer_text: prev.footer_text,
      footer_contact: prev.footer_contact,
    }));
    toast.success(`Template "${template.name}" aplicado!`);
  };

  return (
    <div className="flex flex-col h-full border-l border-border/20 bg-card/30">
      {/* Tab header */}
      <div className="flex border-b border-border/15 bg-card/40">
        {([
          { key: "properties" as const, icon: <SlidersHorizontal className="h-3.5 w-3.5" />, label: "Propriedades" },
          { key: "templates" as const, icon: <LayoutTemplate className="h-3.5 w-3.5" />, label: "Templates" },
        ]).map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 px-3 py-3 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5",
              tab === key
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "properties" ? (
            <PropertiesContent
              form={form}
              setForm={setForm}
              selectedBlock={selectedBlock}
              onResetBlockLayout={onResetBlockLayout}
              uploading={uploading}
              onUpload={handleUpload}
            />
          ) : (
            <TemplatesContent onApply={applyTemplate} currentBg={form.background_color} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ─── Properties Content ─── */

function PropertiesContent({ form, setForm, selectedBlock, onResetBlockLayout, uploading, onUpload }: {
  form: Partial<PdfSettings>;
  setForm: React.Dispatch<React.SetStateAction<Partial<PdfSettings>>>;
  selectedBlock: BlockId;
  onResetBlockLayout: () => void;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, prefix: string, key: keyof PdfSettings) => void;
}) {
  const meta = BLOCK_META[selectedBlock];

  return (
    <div className="space-y-5">
      {/* Block context header */}
      <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-foreground">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground rounded-lg"
            onClick={onResetBlockLayout}
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>
      </div>

      {/* Global colors */}
      <SettingSection icon={<Palette className="h-3.5 w-3.5" />} title="Cores globais">
        <ColorRow label="Fundo" value={form.background_color ?? "#0B0D12"} onChange={v => setForm(p => ({ ...p, background_color: v }))} />
        <ColorRow label="Destaque" value={form.accent_color ?? "#7C5CFF"} onChange={v => setForm(p => ({ ...p, accent_color: v }))} />
        <ColorRow label="Título" value={form.title_color ?? "#FFFFFF"} onChange={v => setForm(p => ({ ...p, title_color: v }))} />
        <ColorRow label="Subtítulo" value={form.subtitle_color ?? "#AAAAAA"} onChange={v => setForm(p => ({ ...p, subtitle_color: v }))} />
      </SettingSection>

      <Separator className="opacity-20" />

      {/* Block-specific settings */}
      <SettingSection icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title={`Config: ${meta.label}`}>
        {selectedBlock === "cover" && (
          <CoverSettings form={form} setForm={setForm} uploading={uploading} onUpload={onUpload} />
        )}
        {selectedBlock === "cards" && (
          <CardsSettings form={form} setForm={setForm} />
        )}
        {selectedBlock === "carousel" && (
          <CarouselSettings form={form} setForm={setForm} />
        )}
        {selectedBlock === "footer" && (
          <FooterSettings form={form} setForm={setForm} uploading={uploading} onUpload={onUpload} />
        )}
      </SettingSection>

      <Separator className="opacity-20" />

      {/* Layout */}
      <SettingSection icon={<Type className="h-3.5 w-3.5" />} title="Layout geral">
        <SliderRow label="Margem" value={form.margin_size ?? 60} onChange={v => setForm(p => ({ ...p, margin_size: v }))} min={20} max={120} step={5} suffix="px" />
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/15 border border-border/10">
          <Type className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Fonte: <strong className="text-foreground">Bricolage Grotesque</strong></span>
        </div>
      </SettingSection>
    </div>
  );
}

/* ─── Templates Content ─── */

function TemplatesContent({ onApply, currentBg }: { onApply: (t: PdfTemplate) => void; currentBg?: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-muted/10 border border-border/10 p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px]">Aplique um template para alterar cores, fontes e proporções. Logos e textos são preservados.</span>
        </div>
      </div>

      <div className="space-y-2">
        {PDF_TEMPLATES.map(template => {
          const isActive = currentBg === template.settings.background_color;
          return (
            <button
              key={template.id}
              onClick={() => onApply(template)}
              className={cn(
                "w-full text-left rounded-xl border p-3 transition-all group hover:shadow-md",
                isActive
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                  : "border-border/15 hover:border-border/30 bg-card/20 hover:bg-card/40"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Color swatch preview */}
                <div className="flex gap-1 shrink-0">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: template.settings.background_color }}>
                    {template.thumbnail}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="h-[15px] w-3 rounded-sm" style={{ backgroundColor: template.settings.accent_color }} />
                    <div className="h-[15px] w-3 rounded-sm" style={{ backgroundColor: template.settings.title_color }} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold truncate">{template.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{template.description}</p>
                </div>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground",
                  "group-hover:translate-x-0.5 group-hover:text-foreground"
                )} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shared Primitives ─── */

function SettingSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
      </div>
      <div className="space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max, step = 1, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{value}{suffix}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative shrink-0">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <div className="h-6 w-6 rounded-md border border-border/30 shadow-sm" style={{ backgroundColor: value }} />
      </div>
      <Label className="text-[10px] text-muted-foreground flex-1 min-w-0">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-6 text-[9px] w-[72px] font-mono rounded-md px-1.5" />
    </div>
  );
}

function UploadRow({ label, value, onUpload, onRemove, uploading }: {
  label: string; value: string | null; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; uploading: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/30 bg-muted/20 text-[10px] font-medium cursor-pointer hover:bg-muted/40 transition-colors">
          <ImageIcon className="h-3 w-3" />{uploading ? "..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        {value && <Button variant="ghost" size="sm" className="text-[10px] h-6 rounded-lg text-muted-foreground hover:text-destructive" onClick={onRemove}>Remover</Button>}
      </div>
      {value && (
        <div className="mt-2 rounded-lg border border-border/20 overflow-hidden h-10 bg-muted/10">
          <img src={value} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

/* ─── Block Settings ─── */

function CoverSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <>
      <SliderRow label="Título — tamanho" value={form.title_font_size ?? 32} onChange={v => setForm((p: any) => ({ ...p, title_font_size: v }))} min={18} max={54} />
      <SliderRow label="Subtítulo — tamanho" value={form.subtitle_font_size ?? 18} onChange={v => setForm((p: any) => ({ ...p, subtitle_font_size: v }))} min={10} max={34} />
      <UploadRow label="Imagem de fundo" value={form.background_image_url} onUpload={(e: any) => onUpload(e, "bg", "background_image_url")} onRemove={() => setForm((p: any) => ({ ...p, background_image_url: null }))} uploading={uploading} />
      <UploadRow label="Logo da capa" value={form.cover_logo_url} onUpload={(e: any) => onUpload(e, "logo", "cover_logo_url")} onRemove={() => setForm((p: any) => ({ ...p, cover_logo_url: null }))} uploading={uploading} />
    </>
  );
}

function CardsSettings({ form, setForm }: any) {
  return (
    <>
      <SliderRow label="Largura da imagem" value={form.card_image_width_pct ?? 45} onChange={v => setForm((p: any) => ({ ...p, card_image_width_pct: v }))} min={25} max={65} suffix="%" />
      <SliderRow label="Título — tamanho" value={form.card_font_size ?? 14} onChange={v => setForm((p: any) => ({ ...p, card_font_size: v }))} min={10} max={24} />
      <SliderRow label="Data — tamanho" value={form.card_date_font_size ?? 12} onChange={v => setForm((p: any) => ({ ...p, card_date_font_size: v }))} min={8} max={20} />
      <SliderRow label="Legenda — tamanho" value={form.card_caption_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, card_caption_font_size: v }))} min={8} max={18} />
      <div className="flex items-center justify-between py-1">
        <Label className="text-[10px] text-muted-foreground">Mostrar horário</Label>
        <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_time_on_card: v }))} />
      </div>
    </>
  );
}

function CarouselSettings({ form, setForm }: any) {
  return (
    <>
      <SliderRow label="Colunas" value={form.carousel_cols ?? 4} onChange={v => setForm((p: any) => ({ ...p, carousel_cols: v }))} min={2} max={6} />
      <SliderRow label="Linhas" value={form.carousel_rows ?? 2} onChange={v => setForm((p: any) => ({ ...p, carousel_rows: v }))} min={1} max={4} />
      <SliderRow label="Altura das imagens" value={form.carousel_image_height_pct ?? 65} onChange={v => setForm((p: any) => ({ ...p, carousel_image_height_pct: v }))} min={40} max={85} suffix="%" />
      <SliderRow label="Título — tamanho" value={form.carousel_title_font_size ?? 14} onChange={v => setForm((p: any) => ({ ...p, carousel_title_font_size: v }))} min={10} max={24} />
      <SliderRow label="Legenda — tamanho" value={form.carousel_caption_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, carousel_caption_font_size: v }))} min={8} max={18} />
      <SliderRow label="Data — tamanho" value={form.carousel_date_font_size ?? 12} onChange={v => setForm((p: any) => ({ ...p, carousel_date_font_size: v }))} min={8} max={20} />
    </>
  );
}

function FooterSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <>
      <UploadRow label="Logo da agência" value={form.agency_logo_url} onUpload={(e: any) => onUpload(e, "agency-logo", "agency_logo_url")} onRemove={() => setForm((p: any) => ({ ...p, agency_logo_url: null }))} uploading={uploading} />
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1 block">Nome da agência</Label>
        <Input value={form.agency_name ?? ""} onChange={e => setForm((p: any) => ({ ...p, agency_name: e.target.value }))} className="h-7 text-[11px] rounded-lg" placeholder="Ex: Uau Digital" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1 block">Texto do rodapé</Label>
        <Input value={form.footer_text ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_text: e.target.value }))} className="h-7 text-[11px] rounded-lg" placeholder="Cronograma de Conteúdo" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1 block">Contato / Redes</Label>
        <Input value={form.footer_contact ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_contact: e.target.value }))} className="h-7 text-[11px] rounded-lg" placeholder="@agencia • contato@agencia.com" />
      </div>
      <SliderRow label="Nome — tamanho" value={form.footer_title_font_size ?? 32} onChange={v => setForm((p: any) => ({ ...p, footer_title_font_size: v }))} min={18} max={54} />
      <SliderRow label="Texto — tamanho" value={form.footer_subtitle_font_size ?? 18} onChange={v => setForm((p: any) => ({ ...p, footer_subtitle_font_size: v }))} min={10} max={34} />
      <SliderRow label="Contato — tamanho" value={form.footer_contact_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, footer_contact_font_size: v }))} min={8} max={20} />
    </>
  );
}
