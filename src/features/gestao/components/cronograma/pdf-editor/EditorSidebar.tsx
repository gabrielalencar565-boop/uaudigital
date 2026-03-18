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
import { BLOCK_META, LAYOUT_KEYS_BY_BLOCK } from "./types";
import { uploadPdfAsset } from "./use-pdf-settings";
import { toast } from "sonner";

const BLOCK_ICONS: Record<BlockId, React.ReactNode> = {
  cover: <Image className="h-4 w-4" />,
  cards: <CreditCard className="h-4 w-4" />,
  carousel: <Layers className="h-4 w-4" />,
  footer: <FileText className="h-4 w-4" />,
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
    <div className="flex flex-col h-full border-r border-border/30 bg-card/50">
      {/* Sidebar tabs */}
      <div className="flex border-b border-border/20">
        <button
          onClick={() => setSection("blocks")}
          className={cn(
            "flex-1 px-3 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
            section === "blocks" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5" /> Blocos
        </button>
        <button
          onClick={() => setSection("settings")}
          className={cn(
            "flex-1 px-3 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
            section === "settings" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 className="h-3.5 w-3.5" /> Configurações
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {section === "blocks" ? (
            <>
              {/* Block list */}
              <div className="space-y-1.5">
                {blocksOrder.map((blockId, i) => {
                  const meta = BLOCK_META[blockId];
                  const enabled = blocksEnabled[blockId] ?? true;
                  const isActive = selectedBlock === blockId;
                  return (
                    <div
                      key={blockId}
                      onClick={() => onSelectBlock(blockId)}
                      className={cn(
                        "rounded-xl border px-3 py-2 cursor-pointer transition-all group",
                        isActive
                          ? "border-primary/50 bg-primary/5 shadow-sm"
                          : "border-border/20 hover:border-border/40 hover:bg-muted/20",
                        !enabled && "opacity-40"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn("shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>
                          {BLOCK_ICONS[blockId]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{meta.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveBlock(blockId, -1); }} disabled={i === 0}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onMoveBlock(blockId, 1); }} disabled={i === blocksOrder.length - 1}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); onToggleBlock(blockId); }}>
                            {enabled ? <Eye className="h-3 w-3 text-emerald-500" /> : <EyeOff className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-3" />

              {/* Block-specific settings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {BLOCK_META[selectedBlock].label}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] gap-1 text-muted-foreground"
                    onClick={onResetBlockLayout}
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </Button>
                </div>

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
            </>
          ) : (
            /* Global settings */
            <GlobalSettings form={form} setForm={setForm} uploading={uploading} onUpload={handleUpload} />
          )}
        </div>
      </ScrollArea>

      {/* Save button */}
      <div className="p-3 border-t border-border/20">
        <Button size="sm" className="w-full rounded-xl gap-1.5" onClick={onSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar Layout"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function SliderRow({ label, value, onChange, min, max, step = 1, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="flex-1" />
        <span className="text-[10px] font-mono w-10 text-right text-muted-foreground">{value}{suffix}</span>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-7 w-7 rounded-lg border border-border/30 cursor-pointer" />
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-7 text-[10px] flex-1 font-mono" />
      </div>
    </div>
  );
}

function UploadRow({ label, value, onUpload, onRemove, uploading }: {
  label: string; value: string | null; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; uploading: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <label className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/30 bg-muted/30 text-[10px] cursor-pointer hover:bg-muted/50 transition">
          <Upload className="h-3 w-3" />{uploading ? "..." : "Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        {value && <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={onRemove}>Remover</Button>}
      </div>
    </div>
  );
}

function GlobalSettings({ form, setForm, uploading, onUpload }: any) {
  return (
    <div className="space-y-4">
      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Palette className="h-3.5 w-3.5" /> Cores & Visual
      </h4>
      <ColorRow label="Cor de fundo" value={form.background_color ?? "#0B0D12"} onChange={v => setForm((p: any) => ({ ...p, background_color: v }))} />
      <ColorRow label="Cor de destaque" value={form.accent_color ?? "#7C5CFF"} onChange={v => setForm((p: any) => ({ ...p, accent_color: v }))} />
      <ColorRow label="Cor do título" value={form.title_color ?? "#FFFFFF"} onChange={v => setForm((p: any) => ({ ...p, title_color: v }))} />
      <ColorRow label="Cor do subtítulo" value={form.subtitle_color ?? "#AAAAAA"} onChange={v => setForm((p: any) => ({ ...p, subtitle_color: v }))} />

      <Separator />

      <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Type className="h-3.5 w-3.5" /> Layout geral
      </h4>
      <SliderRow label="Margem (px)" value={form.margin_size ?? 60} onChange={v => setForm((p: any) => ({ ...p, margin_size: v }))} min={20} max={120} step={5} suffix="px" />

      <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20">
        <span className="text-[10px] text-muted-foreground">Fonte: <strong className="text-foreground">Bricolage Grotesque</strong></span>
      </div>
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
      <div className="flex items-center gap-2">
        <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_time_on_card: v }))} />
        <Label className="text-[10px]">Mostrar horário</Label>
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
        <Label className="text-[10px] text-muted-foreground">Nome da agência</Label>
        <Input value={form.agency_name ?? ""} onChange={e => setForm((p: any) => ({ ...p, agency_name: e.target.value }))} className="h-7 text-[10px] mt-1" placeholder="Ex: Uau Digital" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Texto do rodapé</Label>
        <Input value={form.footer_text ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_text: e.target.value }))} className="h-7 text-[10px] mt-1" placeholder="Cronograma de Conteúdo" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Contato / Redes</Label>
        <Input value={form.footer_contact ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_contact: e.target.value }))} className="h-7 text-[10px] mt-1" placeholder="@agencia • contato@agencia.com" />
      </div>
      <SliderRow label="Nome — tamanho" value={form.footer_title_font_size ?? 32} onChange={v => setForm((p: any) => ({ ...p, footer_title_font_size: v }))} min={18} max={54} />
      <SliderRow label="Texto — tamanho" value={form.footer_subtitle_font_size ?? 18} onChange={v => setForm((p: any) => ({ ...p, footer_subtitle_font_size: v }))} min={10} max={34} />
      <SliderRow label="Contato — tamanho" value={form.footer_contact_font_size ?? 11} onChange={v => setForm((p: any) => ({ ...p, footer_contact_font_size: v }))} min={8} max={20} />
    </div>
  );
}
