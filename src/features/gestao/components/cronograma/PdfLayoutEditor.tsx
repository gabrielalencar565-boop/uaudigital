import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Palette, Type, LayoutGrid, Save, Upload, GripVertical,
  Eye, EyeOff, ChevronUp, ChevronDown, FileText, Image,
  Users, Calendar, CreditCard, FileDown
} from "lucide-react";
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
  blocks_order: string[];
  blocks_enabled: Record<string, boolean>;
  agenda_layout: string;
  agency_logo_url: string | null;
  agency_name: string;
  footer_text: string;
  footer_contact: string;
}

type BlockId = "cover" | "client_info" | "agenda" | "cards" | "footer";

const BLOCK_META: Record<BlockId, { label: string; icon: React.ReactNode; description: string }> = {
  cover: { label: "Capa", icon: <Image className="h-4 w-4" />, description: "Logo, título, mês e imagem de fundo" },
  client_info: { label: "Informações do Cliente", icon: <Users className="h-4 w-4" />, description: "Nome, projeto, mês e total de postagens" },
  agenda: { label: "Agenda de Postagens", icon: <Calendar className="h-4 w-4" />, description: "Visualização mensal ou por lista" },
  cards: { label: "Cards de Postagem", icon: <CreditCard className="h-4 w-4" />, description: "Detalhes de cada postagem com arte e legenda" },
  footer: { label: "Rodapé", icon: <FileText className="h-4 w-4" />, description: "Logo da agência, contato e redes" },
};

function usePdfSettings() {
  return useQuery<PdfSettings>({
    queryKey: ["pm_pdf_settings"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_pdf_settings").select("*").limit(1).single();
      if (error) throw error;
      return {
        ...data,
        blocks_order: data.blocks_order ?? ["cover", "client_info", "agenda", "cards", "footer"],
        blocks_enabled: data.blocks_enabled ?? { cover: true, client_info: true, agenda: true, cards: true, footer: true },
      };
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

/* ─── Preview Components ─── */

function PreviewCover({ form }: { form: Partial<PdfSettings> }) {
  const accent = form.accent_color ?? "#7C5CFF";
  const bg = form.background_color ?? "#0B0D12";
  return (
    <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg, backgroundImage: form.background_image_url ? `url(${form.background_image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
      {form.background_image_url && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6">
        {form.cover_logo_url && <img src={form.cover_logo_url} alt="Logo" className="h-[120px] object-contain" />}
        <div style={{ fontSize: (form.title_font_size ?? 32) * 2.5, color: form.title_color ?? "#FFFFFF" }} className="font-bold leading-tight text-center px-12">Nome do Cliente</div>
        <div style={{ fontSize: (form.subtitle_font_size ?? 18) * 2, color: form.subtitle_color ?? "#AAAAAA" }} className="text-center">Cronograma — Março 2026</div>
        <div className="h-2 w-40 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

function PreviewClientInfo({ form }: { form: Partial<PdfSettings> }) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  return (
    <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H / 2, backgroundColor: bg }}>
      <div className="flex items-center justify-center h-full gap-20 px-20">
        {[
          { label: "Cliente", value: "Nome do Cliente" },
          { label: "Projeto", value: "Social Media" },
          { label: "Mês", value: "Março 2026" },
          { label: "Postagens", value: "12" },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div style={{ fontSize: 28, color: form.subtitle_color ?? "#AAAAAA" }} className="uppercase tracking-widest">{item.label}</div>
            <div style={{ fontSize: 48, color: form.title_color ?? "#FFFFFF" }} className="font-bold mt-2">{item.value}</div>
            <div className="h-1 w-16 mx-auto mt-3 rounded-full" style={{ backgroundColor: accent }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewAgenda({ form }: { form: Partial<PdfSettings> }) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const isCalendar = (form.agenda_layout ?? "calendar") === "calendar";

  if (isCalendar) {
    const days = Array.from({ length: 35 }, (_, i) => i);
    return (
      <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
        <div className="px-16 py-10">
          <div style={{ fontSize: 36, color: form.title_color ?? "#FFF" }} className="font-bold mb-6">Março 2026</div>
          <div className="grid grid-cols-7 gap-2">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(d => (
              <div key={d} style={{ fontSize: 20, color: form.subtitle_color ?? "#AAA" }} className="text-center font-semibold py-2">{d}</div>
            ))}
            {days.map(i => {
              const day = i - 5; // offset for March 2026
              const isValid = day >= 1 && day <= 31;
              const hasPost = isValid && [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28].includes(day);
              return (
                <div key={i} className="rounded-xl p-3" style={{ backgroundColor: isValid ? "#1a1d27" : "transparent", minHeight: 100, border: hasPost ? `2px solid ${accent}` : "2px solid transparent" }}>
                  {isValid && (
                    <>
                      <div style={{ fontSize: 22, color: "#FFF" }} className="font-bold">{day}</div>
                      {hasPost && <div className="mt-1 rounded px-2 py-1" style={{ backgroundColor: accent + "33", fontSize: 14, color: accent }}>📸 Post</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // List layout
  const posts = [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28];
  return (
    <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div className="px-16 py-10">
        <div style={{ fontSize: 36, color: form.title_color ?? "#FFF" }} className="font-bold mb-6">Agenda — Março 2026</div>
        <div className="space-y-3">
          {posts.slice(0, 8).map(day => (
            <div key={day} className="flex items-center gap-6 rounded-xl px-6 py-4" style={{ backgroundColor: "#1a1d27" }}>
              <div style={{ fontSize: 28, color: accent }} className="font-bold w-20">{String(day).padStart(2, "0")}/03</div>
              <div className="h-8 w-[2px] rounded-full" style={{ backgroundColor: accent + "66" }} />
              <div>
                <div style={{ fontSize: 22, color: "#FFF" }} className="font-semibold">Post do dia {day}</div>
                <div style={{ fontSize: 16, color: "#999" }}>Instagram • Carrossel • 18:00</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewCards({ form }: { form: Partial<PdfSettings> }) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const cardAspect = getCardAspect(form.card_proportion ?? "square");
  const cols = 3;
  const gap = 40;
  const padding = 60;
  const headerH = 100;
  const availW = PDF_W - padding * 2 - gap * (cols - 1);
  const cardW = availW / cols;
  const imageH = cardW / cardAspect;

  return (
    <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div className="flex items-center justify-between px-16" style={{ height: headerH }}>
        <div style={{ fontSize: 36, color: form.title_color ?? "#FFF" }} className="font-bold">Semana 1</div>
        <div className="h-1 flex-1 mx-8 rounded-full" style={{ backgroundColor: accent, opacity: 0.4 }} />
        <div style={{ fontSize: 24, color: form.subtitle_color ?? "#AAA" }}>Março 2026</div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap, padding: `0 ${padding}px` }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#1a1d27", width: cardW }}>
            <div className="flex items-center justify-center" style={{ height: imageH, backgroundColor: "#252830" }}>
              <LayoutGrid className="h-12 w-12" style={{ color: "#3a3d48" }} />
            </div>
            <div className="p-4 space-y-1.5">
              <p style={{ fontSize: form.card_font_size ?? 14, color: "#FFF" }} className="font-bold leading-tight">Título da postagem {i + 1}</p>
              {(form.show_time_on_card ?? true) && <p style={{ fontSize: form.card_date_font_size ?? 12, color: accent }}>📅 {String(7 + i * 3).padStart(2, "0")}/03 às 18:00</p>}
              {(form.show_caption_on_card ?? true) && <p style={{ fontSize: form.card_caption_font_size ?? 11, color: "#999" }} className="line-clamp-2">Essa é a legenda da postagem que aparecerá no card do PDF...</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewFooter({ form }: { form: Partial<PdfSettings> }) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  return (
    <div className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H / 3, backgroundColor: bg }}>
      <div className="flex items-center justify-center h-full gap-12 px-20">
        {form.agency_logo_url && <img src={form.agency_logo_url} alt="Logo" className="h-[80px] object-contain" />}
        <div className="h-16 w-[2px] rounded-full" style={{ backgroundColor: accent + "66" }} />
        <div>
          <div style={{ fontSize: 32, color: form.title_color ?? "#FFF" }} className="font-bold">{form.agency_name || "Nome da Agência"}</div>
          <div style={{ fontSize: 20, color: form.subtitle_color ?? "#AAA" }} className="mt-1">{form.footer_text || "Cronograma de Conteúdo"}</div>
          <div style={{ fontSize: 18, color: "#666" }} className="mt-1">{form.footer_contact || "@agencia • contato@agencia.com"}</div>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_MAP: Record<BlockId, (form: Partial<PdfSettings>) => React.ReactNode> = {
  cover: (f) => <PreviewCover form={f} />,
  client_info: (f) => <PreviewClientInfo form={f} />,
  agenda: (f) => <PreviewAgenda form={f} />,
  cards: (f) => <PreviewCards form={f} />,
  footer: (f) => <PreviewFooter form={f} />,
};

/* ─── Block Reorder Item ─── */
function BlockItem({ blockId, enabled, onToggle, onMoveUp, onMoveDown, isFirst, isLast, isSelected, onClick }: {
  blockId: BlockId; enabled: boolean; onToggle: () => void; onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean; isSelected: boolean; onClick: () => void;
}) {
  const meta = BLOCK_META[blockId];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all",
        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/30 hover:border-border/60",
        !enabled && "opacity-50"
      )}
      onClick={onClick}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="shrink-0 text-primary">{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {enabled ? <Eye className="h-3.5 w-3.5 text-success" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      </div>
    </div>
  );
}

/* ─── Settings Panels per Block ─── */

function CoverSettings({ form, setForm, uploading, handleUploadBg, handleUploadLogo }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Cor de fundo</Label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={form.background_color ?? "#0B0D12"} onChange={e => setForm((p: any) => ({ ...p, background_color: e.target.value }))} className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer" />
            <Input value={form.background_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, background_color: e.target.value }))} className="h-8 text-xs flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Cor de destaque</Label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={form.accent_color ?? "#7C5CFF"} onChange={e => setForm((p: any) => ({ ...p, accent_color: e.target.value }))} className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer" />
            <Input value={form.accent_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, accent_color: e.target.value }))} className="h-8 text-xs flex-1" />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Imagem de fundo</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadBg} disabled={uploading} />
          </label>
          {form.background_image_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, background_image_url: null }))}>Remover</Button>}
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Logo da capa</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} disabled={uploading} />
          </label>
          {form.cover_logo_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, cover_logo_url: null }))}>Remover</Button>}
        </div>
      </div>
    </div>
  );
}

function TypographySettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-muted-foreground">Título — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.title_font_size ?? 32]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, title_font_size: v }))} min={16} max={56} step={2} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.title_font_size ?? 32}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Cor do título</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={form.title_color ?? "#FFFFFF"} onChange={e => setForm((p: any) => ({ ...p, title_color: e.target.value }))} className="h-7 w-7 rounded border border-border/30 cursor-pointer" />
          <Input value={form.title_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, title_color: e.target.value }))} className="h-7 text-xs flex-1" />
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Subtítulo — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.subtitle_font_size ?? 18]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, subtitle_font_size: v }))} min={10} max={32} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.subtitle_font_size ?? 18}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Cor do subtítulo</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={form.subtitle_color ?? "#AAAAAA"} onChange={e => setForm((p: any) => ({ ...p, subtitle_color: e.target.value }))} className="h-7 w-7 rounded border border-border/30 cursor-pointer" />
          <Input value={form.subtitle_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, subtitle_color: e.target.value }))} className="h-7 text-xs flex-1" />
        </div>
      </div>
    </div>
  );
}

function AgendaSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-muted-foreground">Layout da agenda</Label>
        <Select value={form.agenda_layout ?? "calendar"} onValueChange={v => setForm((p: any) => ({ ...p, agenda_layout: v }))}>
          <SelectTrigger className="h-8 text-xs rounded-xl mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="calendar">Calendário mensal</SelectItem>
            <SelectItem value="list">Lista por dia</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CardsSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-muted-foreground">Proporção dos cards</Label>
        <Select value={form.card_proportion ?? "square"} onValueChange={v => setForm((p: any) => ({ ...p, card_proportion: v }))}>
          <SelectTrigger className="h-8 text-xs rounded-xl mt-1"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="square">Quadrado (1:1)</SelectItem>
            <SelectItem value="portrait">Retrato (4:5)</SelectItem>
            <SelectItem value="landscape">Paisagem (16:9)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Fonte título</Label>
        <div className="flex items-center gap-1 mt-1">
          <Slider value={[form.card_font_size ?? 14]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_font_size: v }))} min={10} max={24} step={1} className="flex-1" />
          <span className="text-[10px] font-mono w-5">{form.card_font_size ?? 14}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Fonte data</Label>
        <div className="flex items-center gap-1 mt-1">
          <Slider value={[form.card_date_font_size ?? 12]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_date_font_size: v }))} min={8} max={20} step={1} className="flex-1" />
          <span className="text-[10px] font-mono w-5">{form.card_date_font_size ?? 12}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Fonte legenda</Label>
        <div className="flex items-center gap-1 mt-1">
          <Slider value={[form.card_caption_font_size ?? 11]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_caption_font_size: v }))} min={8} max={18} step={1} className="flex-1" />
          <span className="text-[10px] font-mono w-5">{form.card_caption_font_size ?? 11}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={form.show_caption_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_caption_on_card: v }))} />
          <Label className="text-xs">Mostrar legenda</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_time_on_card: v }))} />
          <Label className="text-xs">Mostrar horário</Label>
        </div>
      </div>
    </div>
  );
}

function FooterSettings({ form, setForm, uploading, handleUploadAgencyLogo }: any) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-muted-foreground">Logo da agência</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadAgencyLogo} disabled={uploading} />
          </label>
          {form.agency_logo_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, agency_logo_url: null }))}>Remover</Button>}
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Nome da agência</Label>
        <Input value={form.agency_name ?? ""} onChange={e => setForm((p: any) => ({ ...p, agency_name: e.target.value }))} className="h-8 text-xs mt-1" placeholder="Ex: Uau Digital" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Texto padrão</Label>
        <Input value={form.footer_text ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_text: e.target.value }))} className="h-8 text-xs mt-1" placeholder="Cronograma de Conteúdo" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Contato / Redes</Label>
        <Input value={form.footer_contact ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_contact: e.target.value }))} className="h-8 text-xs mt-1" placeholder="@agencia • contato@agencia.com" />
      </div>
    </div>
  );
}

const SETTINGS_MAP: Record<BlockId, string> = {
  cover: "cover",
  client_info: "typography",
  agenda: "agenda",
  cards: "cards",
  footer: "footer",
};

/* ─── Main Editor ─── */

export function PdfLayoutEditor() {
  const settingsQ = usePdfSettings();
  const updateSettings = useUpdatePdfSettings();
  const [form, setForm] = useState<Partial<PdfSettings>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("cover");

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const blocksOrder = (form.blocks_order ?? ["cover", "client_info", "agenda", "cards", "footer"]) as BlockId[];
  const blocksEnabled = (form.blocks_enabled ?? { cover: true, client_info: true, agenda: true, cards: true, footer: true }) as Record<BlockId, boolean>;

  const handleSave = () => {
    if (!form.id) return;
    updateSettings.mutate(form as PdfSettings);
  };

  const moveBlock = useCallback((blockId: BlockId, dir: -1 | 1) => {
    setForm(prev => {
      const order = [...(prev.blocks_order ?? ["cover", "client_info", "agenda", "cards", "footer"])] as BlockId[];
      const idx = order.indexOf(blockId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      return { ...prev, blocks_order: order };
    });
  }, []);

  const toggleBlock = useCallback((blockId: BlockId) => {
    setForm(prev => {
      const enabled = { ...(prev.blocks_enabled ?? { cover: true, client_info: true, agenda: true, cards: true, footer: true }) } as Record<BlockId, boolean>;
      enabled[blockId] = !enabled[blockId];
      return { ...prev, blocks_enabled: enabled };
    });
  }, []);

  const uploadFile = async (file: File, prefix: string) => {
    setUploading(true);
    try {
      const path = `pdf-layouts/${prefix}-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      toast.error("Erro ao carregar imagem");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "bg");
    if (url) { setForm(p => ({ ...p, background_image_url: url })); toast.success("Imagem carregada!"); }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "logo");
    if (url) { setForm(p => ({ ...p, cover_logo_url: url })); toast.success("Logo carregado!"); }
  };

  const handleUploadAgencyLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "agency-logo");
    if (url) { setForm(p => ({ ...p, agency_logo_url: url })); toast.success("Logo carregado!"); }
  };

  if (settingsQ.isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  const renderBlockSettings = () => {
    switch (selectedBlock) {
      case "cover": return <CoverSettings form={form} setForm={setForm} uploading={uploading} handleUploadBg={handleUploadBg} handleUploadLogo={handleUploadLogo} />;
      case "client_info": return <TypographySettings form={form} setForm={setForm} />;
      case "agenda": return <AgendaSettings form={form} setForm={setForm} />;
      case "cards": return <CardsSettings form={form} setForm={setForm} />;
      case "footer": return <FooterSettings form={form} setForm={setForm} uploading={uploading} handleUploadAgencyLogo={handleUploadAgencyLogo} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Editor de Layout do PDF</h3>
          <p className="text-xs text-muted-foreground">Organize e personalize os blocos do cronograma em PDF (1920×1080px)</p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="h-3.5 w-3.5" /> Salvar Layout
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left: Block organizer + settings */}
        <div className="space-y-4">
          {/* Block list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Blocos do PDF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {blocksOrder.map((blockId, i) => (
                <BlockItem
                  key={blockId}
                  blockId={blockId}
                  enabled={blocksEnabled[blockId] ?? true}
                  onToggle={() => toggleBlock(blockId)}
                  onMoveUp={() => moveBlock(blockId, -1)}
                  onMoveDown={() => moveBlock(blockId, 1)}
                  isFirst={i === 0}
                  isLast={i === blocksOrder.length - 1}
                  isSelected={selectedBlock === blockId}
                  onClick={() => setSelectedBlock(blockId)}
                />
              ))}
            </CardContent>
          </Card>

          {/* Block-specific settings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {BLOCK_META[selectedBlock].icon}
                {BLOCK_META[selectedBlock].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderBlockSettings()}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold">Pré-visualização</h4>
            <span className="text-[10px] text-muted-foreground">({PDF_W}×{PDF_H}px)</span>
          </div>

          <div className="space-y-4">
            {blocksOrder.filter(b => blocksEnabled[b]).map(blockId => (
              <div
                key={blockId}
                className={cn(
                  "rounded-2xl border overflow-hidden transition-all cursor-pointer",
                  selectedBlock === blockId ? "border-primary shadow-lg shadow-primary/10" : "border-border/30"
                )}
                onClick={() => setSelectedBlock(blockId)}
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/20">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{BLOCK_META[blockId].label}</span>
                </div>
                <div className="bg-black/20">
                  <div
                    className="origin-top-left"
                    style={{ width: PDF_W }}
                    ref={(el) => {
                      if (!el) return;
                      const parent = el.parentElement;
                      if (!parent) return;
                      const ro = new ResizeObserver(() => {
                        const parentW = parent.clientWidth;
                        const s = parentW / PDF_W;
                        el.style.transform = `scale(${s})`;
                        el.style.transformOrigin = "top left";
                        const child = el.firstElementChild as HTMLElement;
                        if (child) parent.style.height = `${child.offsetHeight * s}px`;
                      });
                      ro.observe(parent);
                      // Initial
                      const parentW = parent.clientWidth;
                      const s = parentW / PDF_W;
                      el.style.transform = `scale(${s})`;
                      el.style.transformOrigin = "top left";
                      const child = el.firstElementChild as HTMLElement;
                      if (child) parent.style.height = `${child.offsetHeight * s}px`;
                    }}
                  >
                    {PREVIEW_MAP[blockId](form)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
