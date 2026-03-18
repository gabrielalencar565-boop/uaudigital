import { useState } from "react";
import {
  Image, CreditCard, Layers, FileText, ChevronUp, ChevronDown,
  Eye, EyeOff, Upload, Type, Palette, Settings2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BlockId, PdfSettings, LayoutPoint } from "./types";
import { BLOCK_META } from "./types";
import { uploadPdfAsset } from "./use-pdf-settings";
import { toast } from "sonner";

const BLOCK_ICONS: Record<BlockId, React.ReactNode> = {
  cover: <Image className="h-3.5 w-3.5" />,
  cards: <CreditCard className="h-3.5 w-3.5" />,
  carousel: <Layers className="h-3.5 w-3.5" />,
  footer: <FileText className="h-3.5 w-3.5" />,
};

interface Props {
  form: Partial<PdfSettings>;
  setForm: React.Dispatch<React.SetStateAction<Partial<PdfSettings>>>;
  blocksOrder: BlockId[];
  blocksEnabled: Record<BlockId, boolean>;
  selectedBlock: BlockId;
  onSelectBlock: (b: BlockId) => void;
  onMoveBlock: (b: BlockId, dir: -1 | 1) => void;
  onToggleBlock: (b: BlockId) => void;
  onResetBlockLayout: () => void;
  onSave: () => void;
  saving: boolean;
}

export function EditorSidebar({
  form, setForm, blocksOrder, blocksEnabled, selectedBlock,
  onSelectBlock, onMoveBlock, onToggleBlock, onResetBlockLayout, onSave, saving,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [section, setSection] = useState<"blocks" | "settings">("blocks");

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

  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/30">
      {/* Tab header */}
      <div className="flex border-b border-border/15 bg-card/40">
        {(["blocks", "settings"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSection(tab)}
            className={cn(
              "flex-1 px-3 py-3 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5",
              section === tab
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "blocks" ? <><Layers className="h-3.5 w-3.5" /> Blocos</> : <><Settings2 className="h-3.5 w-3.5" /> Config</>}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {section === "blocks" ? (
            <>
              {/* Block list */}
              <div>
                <SectionLabel>Páginas do PDF</SectionLabel>
                <div className="space-y-1.5 mt-2">
                  {blocksOrder.map((blockId, i) => {
                    const meta = BLOCK_META[blockId];
                    const enabled = blocksEnabled[blockId] ?? true;
                    const isActive = selectedBlock === blockId;
                    return (
                      <div
                        key={blockId}
                        onClick={() => onSelectBlock(blockId)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 cursor-pointer transition-all group",
                          isActive
                            ? "border-primary/40 bg-primary/5 shadow-sm"
                            : "border-transparent hover:border-border/30 hover:bg-muted/15",
                          !enabled && "opacity-35"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "flex items-center justify-center h-7 w-7 rounded-lg shrink-0 transition-colors",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground"
                          )}>
                            {BLOCK_ICONS[blockId]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate">{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{meta.description}</p>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={(e) => { e.stopPropagation(); onMoveBlock(blockId, -1); }} disabled={i === 0}>
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={(e) => { e.stopPropagation(); onMoveBlock(blockId, 1); }} disabled={i === blocksOrder.length - 1}>
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={(e) => { e.stopPropagation(); onToggleBlock(blockId); }}>
                              {enabled ? <Eye className="h-3 w-3 text-success" /> : <EyeOff className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className="opacity-30" />

              {/* Block-specific settings */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>{BLOCK_META[selectedBlock].label}</SectionLabel>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                    onClick={onResetBlockLayout}
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </Button>
                </div>

                <div className="space-y-3">
                  {selectedBlock === "cover" && (
                    <CoverBlockSettings form={form} setForm={setForm} uploading={uploading} onUpload={handleUpload} />
                  )}
                  {selectedBlock === "cards" && (
                    <CardsBlockSettings form={form} setForm={setForm} />
                  )}
                  {selectedBlock === "carousel" && (
                    <CarouselBlockSettings form={form} setForm={setForm} />
                  )}
                  {selectedBlock === "footer" && (
                    <FooterBlockSettings form={form} setForm={setForm} uploading={uploading} onUpload={handleUpload} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <GlobalSettings form={form} setForm={setForm} uploading={uploading} onUpload={handleUpload} />
          )}
        </div>
      </ScrollArea>

      {/* Save button */}
      <div className="p-4 border-t border-border/15">
        <Button size="sm" className="w-full rounded-xl gap-1.5 h-9" onClick={onSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar Layout"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Shared UI ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
      {children}
    </h4>
  );
}

function SettingGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
      </div>
      {children}
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
    <div>
      <Label className="text-[10px] text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          <div className="h-7 w-7 rounded-lg border border-border/30 shadow-sm" style={{ backgroundColor: value }} />
        </div>
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[10px] flex-1 font-mono rounded-lg" />
      </div>
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
          <Upload className="h-3 w-3" />{uploading ? "Enviando..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        {value && <Button variant="ghost" size="sm" className="text-[10px] h-6 rounded-lg text-muted-foreground hover:text-destructive" onClick={onRemove}>Remover</Button>}
      </div>
      {value && (
        <div className="mt-2 rounded-lg border border-border/20 overflow-hidden h-12 bg-muted/10">
          <img src={value} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}

/* ─── Settings Panels ─── */

function GlobalSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <div className="space-y-5">
      <SettingGroup icon={<Palette className="h-3.5 w-3.5" />} title="Cores & Visual">
        <ColorRow label="Cor de fundo" value={form.background_color ?? "#0B0D12"} onChange={v => setForm((p: any) => ({ ...p, background_color: v }))} />
        <ColorRow label="Cor de destaque" value={form.accent_color ?? "#7C5CFF"} onChange={v => setForm((p: any) => ({ ...p, accent_color: v }))} />
        <ColorRow label="Cor do título" value={form.title_color ?? "#FFFFFF"} onChange={v => setForm((p: any) => ({ ...p, title_color: v }))} />
        <ColorRow label="Cor do subtítulo" value={form.subtitle_color ?? "#AAAAAA"} onChange={v => setForm((p: any) => ({ ...p, subtitle_color: v }))} />
      </SettingGroup>

      <Separator className="opacity-30" />

      <SettingGroup icon={<Type className="h-3.5 w-3.5" />} title="Layout geral">
        <SliderRow label="Margem" value={form.margin_size ?? 60} onChange={v => setForm((p: any) => ({ ...p, margin_size: v }))} min={20} max={120} step={5} suffix="px" />
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/15 border border-border/10">
          <Type className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Fonte: <strong className="text-foreground">Bricolage Grotesque</strong></span>
        </div>
      </SettingGroup>
    </div>
  );
}

function CoverBlockSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <div className="space-y-3">
      <SliderRow label="Título — tamanho" value={form.title_font_size ?? 32} onChange={v => setForm((p: any) => ({ ...p, title_font_size: v }))} min={18} max={54} />
      <SliderRow label="Subtítulo — tamanho" value={form.subtitle_font_size ?? 18} onChange={v => setForm((p: any) => ({ ...p, subtitle_font_size: v }))} min={10} max={34} />
      <UploadRow
        label="Imagem de fundo"
        value={form.background_image_url}
        onUpload={(e: any) => onUpload(e, "bg", "background_image_url")}
        onRemove={() => setForm((p: any) => ({ ...p, background_image_url: null }))}
        uploading={uploading}
      />
      <UploadRow
        label="Logo da capa"
        value={form.cover_logo_url}
        onUpload={(e: any) => onUpload(e, "logo", "cover_logo_url")}
        onRemove={() => setForm((p: any) => ({ ...p, cover_logo_url: null }))}
        uploading={uploading}
      />
    </div>
  );
}

function CardsBlockSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <SliderRow label="Largura da imagem" value={form.card_image_width_pct ?? 45} onChange={v => setForm((p: any) => ({ ...p, card_image_width_pct: v }))} min={25} max={65} suffix="%" />
      <SliderRow label="Título — tamanho" value={form.card_font_size ?? 14} onChange={v => setForm((p: any) => ({ ...p, card_font_size: v }))} min={10} max={24} />
      <SliderRow label="Data — tamanho" value={form.card_date_font_size ?? 12} onChange={v => setForm((p: any) => ({ ...p, card_date_font_size: v }))} min={8} max={20} />
      <SliderRow label="Legenda — tamanho" value={form.card_caption_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, card_caption_font_size: v }))} min={8} max={18} />
      <div className="flex items-center justify-between py-1">
        <Label className="text-[10px] text-muted-foreground">Mostrar horário</Label>
        <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_time_on_card: v }))} />
      </div>
    </div>
  );
}

function CarouselBlockSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <SliderRow label="Colunas" value={form.carousel_cols ?? 4} onChange={v => setForm((p: any) => ({ ...p, carousel_cols: v }))} min={2} max={6} />
      <SliderRow label="Linhas" value={form.carousel_rows ?? 2} onChange={v => setForm((p: any) => ({ ...p, carousel_rows: v }))} min={1} max={4} />
      <SliderRow label="Altura das imagens" value={form.carousel_image_height_pct ?? 65} onChange={v => setForm((p: any) => ({ ...p, carousel_image_height_pct: v }))} min={40} max={85} suffix="%" />
      <SliderRow label="Título — tamanho" value={form.carousel_title_font_size ?? 14} onChange={v => setForm((p: any) => ({ ...p, carousel_title_font_size: v }))} min={10} max={24} />
      <SliderRow label="Legenda — tamanho" value={form.carousel_caption_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, carousel_caption_font_size: v }))} min={8} max={18} />
      <SliderRow label="Data — tamanho" value={form.carousel_date_font_size ?? 12} onChange={v => setForm((p: any) => ({ ...p, carousel_date_font_size: v }))} min={8} max={20} />
    </div>
  );
}

function FooterBlockSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <div className="space-y-3">
      <UploadRow
        label="Logo da agência"
        value={form.agency_logo_url}
        onUpload={(e: any) => onUpload(e, "agency-logo", "agency_logo_url")}
        onRemove={() => setForm((p: any) => ({ ...p, agency_logo_url: null }))}
        uploading={uploading}
      />
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Nome da agência</Label>
        <Input value={form.agency_name ?? ""} onChange={e => setForm((p: any) => ({ ...p, agency_name: e.target.value }))} className="h-8 text-[11px] rounded-lg" placeholder="Ex: Uau Digital" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Texto do rodapé</Label>
        <Input value={form.footer_text ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_text: e.target.value }))} className="h-8 text-[11px] rounded-lg" placeholder="Cronograma de Conteúdo" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Contato / Redes</Label>
        <Input value={form.footer_contact ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_contact: e.target.value }))} className="h-8 text-[11px] rounded-lg" placeholder="@agencia • contato@agencia.com" />
      </div>
      <SliderRow label="Nome — tamanho" value={form.footer_title_font_size ?? 32} onChange={v => setForm((p: any) => ({ ...p, footer_title_font_size: v }))} min={18} max={54} />
      <SliderRow label="Texto — tamanho" value={form.footer_subtitle_font_size ?? 18} onChange={v => setForm((p: any) => ({ ...p, footer_subtitle_font_size: v }))} min={10} max={34} />
      <SliderRow label="Contato — tamanho" value={form.footer_contact_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, footer_contact_font_size: v }))} min={8} max={20} />
    </div>
  );
}
