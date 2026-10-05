import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Clock, DollarSign, Eye, ImagePlus, Link2, ListChecks, LogIn, Palette, RotateCcw, Sparkles, Store, Moon, Sun, Target, Trash2, Trophy, UserRound, Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ColorPickerPopover } from "@/components/ui/color-picker-popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { DEFAULT_BRAND_GRADIENT_STOPS, deriveBrandPalette } from "@/lib/brand-gradient";
import { brandGlowPalette, hexToHsl, twoColorGlowPalette } from "@/lib/color";
import { DEFAULT_LINK_PREVIEW_DESCRIPTION, DEFAULT_LINK_PREVIEW_TITLE, LINK_PREVIEW_VARIABLES, renderLinkPreviewTemplate } from "@/lib/approval-link-preview";
import { AdminAparenciaPanel } from "./AdminAparenciaPanel";
import { DriveIntegrationCard } from "./DriveIntegrationCard";

const DEFAULT_BRAND_COLOR = "#6932c9";
const PRESETS = ["#6932c9", "#3b82f6", "#f97316", "#ef4444", "#a855f7", "#10b981", "#ec4899", "#f59e0b"];
const SIDEBAR_PRESETS = ["#14532d", "#1e293b", "#2e1a47", "#3f3a14", "#18181b", "#3b1414", "#0c2d48", "#2a1f1f"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function Section({ icon: Icon, title, badge, defaultOpen = true, children }: {
  icon: typeof Palette; title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border/40 bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        {badge && <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{badge}</span>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5 border-t border-border/30 px-5 py-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// Swatch presets + free color picker + hex field. `optional` fields can be cleared back to "automatic".
function ColorField({ label, hint, value, onChange, presets, optional, autoLabel = "Automático" }: {
  label: string; hint?: string; value: string | null; onChange: (v: string | null) => void;
  presets?: string[]; optional?: boolean; autoLabel?: string;
}) {
  const shown = value ?? "";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        {optional && value && (
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange(null)}>Voltar ao {autoLabel.toLowerCase()}</button>
        )}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-card transition hover:scale-110", shown.toLowerCase() === c && "ring-2 ring-foreground/60")}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <ColorPickerPopover value={HEX.test(shown) ? shown : "#888888"} onChange={(v) => onChange(v)} />
        <Input
          value={shown}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === "" && optional ? null : v);
          }}
          placeholder={optional ? "#" : "#6932c9"}
          maxLength={7}
          className="h-9 w-32 font-mono text-sm"
        />
        {optional && !value && <span className="text-xs text-muted-foreground">{autoLabel}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Miniature of the real "Meu Painel" page (sidebar, welcome banner, KPI cards, productivity chart), drawn only
// from the draft colors so the owner sees the whole look before saving.
const PREVIEW_NAV = [
  { label: "Meu Painel", icon: UserRound },
  { label: "Agenda", icon: CalendarDays },
  { label: "Pauta", icon: ClipboardList },
  { label: "Clientes", icon: Users },
  { label: "Visão do Dia", icon: Eye },
  { label: "Magic Number", icon: Target },
  { label: "The Best", icon: Trophy },
  { label: "Financeiro", icon: DollarSign },
];
const PREVIEW_KPIS = [
  { label: "Tarefas", icon: ListChecks, tint: null },
  { label: "Concluídas", icon: CheckCircle2, tint: "#22c55e" },
  { label: "Pendentes", icon: Clock, tint: "#f59e0b" },
  { label: "Atrasadas", icon: AlertTriangle, tint: "#ef4444" },
] as const;

function LivePreview({ brand, sidebar, accent, from, to, name, slogan }: {
  brand: string; sidebar: string; accent: string | null; from: string | null; to: string | null; name: string; slogan: string;
}) {
  const uid = useId().replace(/:/g, "");
  const glow = from || to ? twoColorGlowPalette(from ?? brand, to ?? accent ?? from ?? brand) : brandGlowPalette(brand);
  const hsl = (t: string) => `hsl(${t})`;
  const palette = deriveBrandPalette({ brand, defaultBrand: DEFAULT_BRAND_COLOR, accent, from, to });
  const stops = palette?.stops ?? [...DEFAULT_BRAND_GRADIENT_STOPS];
  const chartCss = `linear-gradient(180deg, ${stops[2]}, ${stops[1]} 55%, ${stops[0]})`;
  const sb = hexToHsl(sidebar);
  const onSidebar = sb.l > 65 ? "#111" : "#fff";
  const activeBg = `hsl(${sb.h} ${sb.s}% ${Math.max(0, sb.l - 10)}%)`;
  const onBrand = hexToHsl(brand).l > 65 ? "#111" : "#fff";
  const ringR = 15;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border/40 bg-background shadow-sm">
      {/* Sidebar */}
      <div className="hidden w-32 shrink-0 flex-col gap-1 p-3 sm:flex" style={{ background: sidebar, color: onSidebar }}>
        <div className="mb-1 min-w-0">
          <div className="truncate text-[10px] font-bold leading-tight">{name || "Sua agência"}</div>
          {slogan && <div className="truncate text-[8px] italic opacity-70">{slogan}</div>}
        </div>
        <div className="mb-1 h-px" style={{ background: onSidebar, opacity: 0.15 }} />
        {PREVIEW_NAV.map((n, i) => (
          <div key={n.label} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[8.5px]" style={i === 0 ? { background: activeBg, fontWeight: 600 } : { opacity: 0.8 }}>
            <n.icon className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{n.label}</span>
          </div>
        ))}
      </div>

      {/* Meu Painel */}
      <div className="min-w-0 flex-1 space-y-2.5 p-3">
        {/* Welcome banner */}
        <div
          className="relative flex items-center gap-2.5 overflow-hidden rounded-2xl p-3 text-white"
          style={{ background: `linear-gradient(135deg, ${hsl(glow.glow1)}, ${hsl(glow.glow2)} 30%, ${hsl(glow.glow3)} 60%, ${hsl(glow.glow4)})` }}
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 60% 70% at 78% 40%, hsl(${glow.glow5} / 0.35), transparent 70%)` }} />
          <span className="relative shrink-0 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${hsl(glow.glow6)}, ${hsl(glow.glow7)}, ${hsl(glow.glow5)})` }}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-[10px] font-bold">{(name.trim().charAt(0) || "U").toUpperCase()}</span>
          </span>
          <div className="relative min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold">Boa noite, Ana</div>
            <div className="truncate text-[8px] opacity-80">O trabalho chato de hoje é o case de amanhã.</div>
          </div>
          <div className="relative hidden shrink-0 items-center gap-2 sm:flex">
            <div className="rounded-xl bg-white/15 px-2 py-1 text-center backdrop-blur">
              <div className="text-[6.5px] font-semibold uppercase tracking-wider opacity-80">Mensal</div>
              <div className="text-[10px] font-bold leading-none">8º <span className="text-[8px] font-medium opacity-80">0 pts</span></div>
            </div>
            <svg width="38" height="38" viewBox="0 0 38 38">
              <defs>
                <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={stops[0]} /><stop offset="55%" stopColor={stops[1]} /><stop offset="100%" stopColor={stops[2]} />
                </linearGradient>
              </defs>
              <circle cx="19" cy="19" r={ringR} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="4" />
              <circle cx="19" cy="19" r={ringR} fill="none" stroke={`url(#ring-${uid})`} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${ringC * 0.62} ${ringC}`} transform="rotate(-90 19 19)" />
              <text x="19" y="21.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">62%</text>
            </svg>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-1.5">
          {PREVIEW_KPIS.map((k) => (
            <div key={k.label} className="flex items-center gap-1.5 rounded-xl border border-border/40 bg-card p-1.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ background: `${k.tint ?? brand}26`, color: k.tint ?? brand }}>
                <k.icon className="h-2.5 w-2.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[6.5px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <span className="block text-[11px] font-bold leading-none">0</span>
              </span>
            </div>
          ))}
        </div>

        {/* Tasks + productivity */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl border border-border/40 bg-card p-2">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-semibold">Minhas tarefas</span>
              <span className="flex rounded-full bg-muted p-0.5 text-[6.5px] font-semibold">
                <span className="rounded-full px-1.5 py-0.5" style={{ background: brand, color: onBrand }}>Hoje</span>
                <span className="px-1.5 py-0.5 text-muted-foreground">Semana</span>
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {[70, 52, 38].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-muted" style={{ width: `${w}%` }} />)}
            </div>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-2">
            <span className="text-[8.5px] font-semibold">Sua produtividade</span>
            <div className="mt-1.5 flex h-10 items-end gap-1">
              {[38, 60, 46, 78, 64, 92, 70].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: chartCss }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Logo uploader in the style of the reference: one box per theme (dark = main, light = optional). Used on the
// login and the client approval pages; if the light one is missing, the dark logo is used in both.
function LogoSlot({ title, optional, light, field, folder }: {
  title: string; optional?: boolean; light?: boolean; field: "sidebar_logo_dark_url" | "sidebar_logo_url"; folder: string;
}) {
  const q = useAppSettings();
  const update = useUpdateAppSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = q.data?.[field] ?? null;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      await update.mutateAsync({ [field]: supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl });
      toast.success("Logo atualizada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar a logo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-muted/30 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {light ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />} Logo · modo {light ? "claro" : "escuro"}
        {optional && <span className="font-normal normal-case tracking-normal opacity-70">(opcional)</span>}
      </p>
      <div className="flex items-center gap-4">
        <div className={cn("grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/40", light ? "bg-white" : "bg-neutral-500")}>
          {url ? <img src={url} alt={title} className="max-h-full max-w-full object-contain p-2" /> : <ImagePlus className={cn("h-5 w-5", light ? "text-neutral-400" : "text-neutral-300")} />}
        </div>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" className="rounded-xl" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Enviando…" : url ? "Trocar logo" : "Enviar logo"}
          </Button>
          {url && (
            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => update.mutate({ [field]: null }, { onSuccess: () => toast.success("Logo removida") })}>
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FaviconUpload() {
  const q = useAppSettings();
  const update = useUpdateAppSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = q.data?.favicon_url ?? null;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("Máximo 3 MB"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `favicon/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      await update.mutateAsync({ favicon_url: supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl });
      toast.success("Ícone atualizado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar o ícone");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-border/40 bg-muted/40">
        {url ? <img src={url} alt="Ícone" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Enviando…" : url ? "Trocar ícone" : "Enviar ícone"}</Button>
          {url && (
            <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => update.mutate({ favicon_url: null }, { onSuccess: () => toast.success("Ícone removido") })}>
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Aparece na aba do navegador. Recomendado: 512 × 512 px, PNG quadrado, até 3 MB.</p>
      </div>
    </div>
  );
}

const WA_BG = "#0b141a";

function LinkPreviewSection() {
  const q = useAppSettings();
  const update = useUpdateAppSettings();
  const s = q.data;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const loaded = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const descInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!s || loaded.current) return;
    loaded.current = true;
    setTitle(s.link_preview_title ?? "");
    setDescription(s.link_preview_description ?? "");
  }, [s]);

  const imageUrl = s?.link_preview_image_url ?? null;
  const dirty = title.trim() !== (s?.link_preview_title ?? "") || description.trim() !== (s?.link_preview_description ?? "");
  const now = new Date();
  const vars = { cliente: "Dra. Luanna", mes: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][now.getMonth()], ano: String(now.getFullYear()) };
  const shownTitle = renderLinkPreviewTemplate(title.trim() || DEFAULT_LINK_PREVIEW_TITLE, vars);
  const shownDescription = renderLinkPreviewTemplate(description.trim() || DEFAULT_LINK_PREVIEW_DESCRIPTION, vars);
  const host = typeof window !== "undefined" ? window.location.host : "app";

  const insert = (field: "title" | "description", token: string) => {
    const el = field === "title" ? titleInput.current : descInput.current;
    const value = field === "title" ? title : description;
    const pos = el?.selectionStart ?? value.length;
    const next = value.slice(0, pos) + token + value.slice(el?.selectionEnd ?? pos);
    (field === "title" ? setTitle : setDescription)(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + token.length, pos + token.length); });
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `link-preview/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      await update.mutateAsync({ link_preview_image_url: supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl });
      toast.success("Imagem atualizada!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar a imagem");
    } finally {
      setUploading(false);
    }
  };

  const save = () =>
    update.mutate(
      { link_preview_title: title.trim() || null, link_preview_description: description.trim() || null },
      { onSuccess: () => toast.success("Texto do link salvo!"), onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar") },
    );

  const VariableChips = ({ field }: { field: "title" | "description" }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Inserir:</span>
      {LINK_PREVIEW_VARIABLES.map((v) => (
        <button key={v.token} type="button" onClick={() => insert(field, v.token)} className="rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground">
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Imagem</label>
          <div className="flex items-center gap-4">
            <div className="grid aspect-[1.91/1] w-44 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
              {imageUrl ? <img src={imageUrl} alt="Miniatura do link" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="space-y-2">
              <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              <Button variant="outline" size="sm" className="rounded-full" disabled={uploading} onClick={() => imageInput.current?.click()}>
                {uploading ? "Enviando…" : imageUrl ? "Trocar imagem" : "Enviar imagem"}
              </Button>
              {imageUrl && (
                <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => update.mutate({ link_preview_image_url: null }, { onSuccess: () => toast.success("Imagem removida") })}>
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              )}
              <p className="text-[11px] text-muted-foreground">1200 × 630 px, até 5 MB.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</label>
          <Input ref={titleInput} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={DEFAULT_LINK_PREVIEW_TITLE} className="h-10" />
          <VariableChips field="title" />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
          <Textarea ref={descInput} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={3} placeholder={DEFAULT_LINK_PREVIEW_DESCRIPTION} />
          <VariableChips field="description" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" disabled={!dirty || update.isPending} onClick={save}>Salvar texto</Button>
          {(title || description) && (
            <Button variant="ghost" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => { setTitle(""); setDescription(""); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Usar texto padrão
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3 w-3" /> Como o cliente vê no WhatsApp</p>
        <div className="rounded-2xl p-4" style={{ background: WA_BG }}>
          <div className="ml-auto max-w-[310px] rounded-xl rounded-tr-sm p-1.5" style={{ background: "#005c4b" }}>
            <div className="overflow-hidden rounded-lg" style={{ background: "#025144" }}>
              {imageUrl ? (
                <img src={imageUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
              ) : (
                <div className="grid aspect-[1.91/1] w-full place-items-center bg-black/25 text-[11px] text-white/50">Sua imagem aparece aqui</div>
              )}
              <div className="space-y-0.5 px-2.5 py-2">
                <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-white">{shownTitle}</p>
                <p className="line-clamp-2 text-[11px] leading-snug text-white/70">{shownDescription}</p>
                <p className="truncate text-[10px] text-white/50">{host}</p>
              </div>
            </div>
            <p className="truncate px-1.5 pb-0.5 pt-1.5 text-[12px] text-[#53bdeb] underline">https://{host}/aprovacao/9f3c1a7e-…</p>
            <p className="px-1.5 text-right text-[9px] text-white/50">09:41 ✓✓</p>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O link de aprovação é gerado em cada Cronograma (botão "Link do cliente"). {"{cliente}"}, {"{mes}"} e {"{ano}"} são trocados pelo nome do cliente e pelo ciclo de cada link.
        </p>
      </div>
    </div>
  );
}

function DiaDSection() {
  const q = useAppSettings();
  const update = useUpdateAppSettings();
  const [day, setDay] = useState("27");
  const [label, setLabel] = useState("Magic Number");
  const loaded = useRef(false);
  useEffect(() => {
    if (!q.data || loaded.current) return;
    loaded.current = true;
    setDay(String(q.data.magic_number_day));
    setLabel(q.data.magic_number_label);
  }, [q.data]);
  const dirty = !!q.data && (String(q.data.magic_number_day) !== day || q.data.magic_number_label !== label.trim());

  const save = () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 28) { toast.error("O dia deve ser um número entre 1 e 28"); return; }
    if (!label.trim()) { toast.error("Informe um nome"); return; }
    update.mutate({ magic_number_day: n, magic_number_label: label.trim() }, {
      onSuccess: () => toast.success("Dia D salvo!"), onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        O dia de fechamento mensal da operação. Depois dele, os painéis passam a mostrar o próximo ciclo, e o nome escolhido aqui substitui "Magic Number" em toda a interface.
      </p>
      <div className="grid max-w-md gap-4 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dia do mês</label>
          <Input type="number" min={1} max={28} value={day} onChange={(e) => setDay(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="h-10" />
        </div>
      </div>
      <Button className="rounded-full" disabled={!dirty || update.isPending} onClick={save}>Salvar</Button>
    </div>
  );
}

export function AdminAgenciaPanel() {
  const q = useAppSettings();
  const update = useUpdateAppSettings();
  const s = q.data;

  const [name, setName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [brand, setBrand] = useState(DEFAULT_BRAND_COLOR);
  const [sidebar, setSidebar] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!s || loaded.current) return;
    loaded.current = true;
    setName(s.workspace_name ?? "");
    setSlogan(s.slogan ?? "");
    setBrand(s.brand_color || DEFAULT_BRAND_COLOR);
    setSidebar(s.sidebar_color);
    setAccent(s.chart_accent_color);
    setFrom(s.header_gradient_from);
    setTo(s.header_gradient_to);
  }, [s]);

  const valid = HEX.test(brand) && [sidebar, accent, from, to].every((c) => c === null || HEX.test(c));
  const dirty = useMemo(() => {
    if (!s) return false;
    return (
      name.trim() !== (s.workspace_name ?? "") ||
      slogan.trim() !== (s.slogan ?? "") ||
      brand.toLowerCase() !== (s.brand_color || DEFAULT_BRAND_COLOR).toLowerCase() ||
      sidebar !== s.sidebar_color || accent !== s.chart_accent_color || from !== s.header_gradient_from || to !== s.header_gradient_to
    );
  }, [s, name, slogan, brand, sidebar, accent, from, to]);
  const isDefaultLook = !s?.sidebar_color && !s?.chart_accent_color && !s?.header_gradient_from && !s?.header_gradient_to && (s?.brand_color ?? DEFAULT_BRAND_COLOR).toLowerCase() === DEFAULT_BRAND_COLOR;

  const save = () => {
    if (!valid) { toast.error("Use cores no formato #RRGGBB"); return; }
    update.mutate(
      {
        workspace_name: name.trim(),
        slogan: slogan.trim() || null,
        brand_color: brand,
        sidebar_color: sidebar,
        chart_accent_color: accent,
        header_gradient_from: from,
        header_gradient_to: to,
      },
      { onSuccess: () => toast.success("Marca e cores salvas!"), onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar") },
    );
  };

  const restore = () => {
    setBrand(DEFAULT_BRAND_COLOR); setSidebar(null); setAccent(null); setFrom(null); setTo(null);
  };

  return (
    <div className="space-y-4">
      <Section icon={Store} title="Marca da agência" badge={s?.workspace_name?.trim() ? "Personalizada" : "Padrão"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <LogoSlot title="Logo modo escuro" field="sidebar_logo_dark_url" folder="sidebar-logo-dark" />
          <LogoSlot title="Logo modo claro" field="sidebar_logo_url" folder="sidebar-logo" light optional />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da agência</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Uau Digital" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Slogan (opcional)</label>
            <Input value={slogan} onChange={(e) => setSlogan(e.target.value)} maxLength={80} placeholder="Ex.: Conteúdo que conecta" className="h-10" />
          </div>
        </div>
      </Section>

      <Section icon={Palette} title="Identidade visual" badge={isDefaultLook ? "Padrão" : "Personalizada"}>
        <div className="grid gap-6 sm:grid-cols-2">
          <ColorField label="Cor principal" hint="Botões de destaque e detalhes da marca." value={brand} onChange={(v) => setBrand(v ?? DEFAULT_BRAND_COLOR)} presets={PRESETS} />
          <ColorField label="Cor da barra lateral" hint="Se ficar automática, usa a cor principal." value={sidebar} onChange={setSidebar} presets={SIDEBAR_PRESETS} optional autoLabel="Igual à principal" />
          <ColorField label="Cor de destaque nos gráficos" hint="Fim do degradê dos gráficos e barras de progresso." value={accent} onChange={setAccent} optional autoLabel="Automático" />
        </div>

        <div className="space-y-3 rounded-xl bg-muted/30 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Degradê dos cabeçalhos</p>
            <p className="text-xs text-muted-foreground">Os banners animados do Meu Painel, Clientes e Magic Number. Automático usa a cor principal.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField label="Cor 1" value={from} onChange={setFrom} optional />
            <ColorField label="Cor 2" value={to} onChange={setTo} optional />
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3 w-3" /> Pré-visualização ao vivo</p>
          <LivePreview brand={HEX.test(brand) ? brand : DEFAULT_BRAND_COLOR} sidebar={sidebar && HEX.test(sidebar) ? sidebar : HEX.test(brand) ? brand : DEFAULT_BRAND_COLOR} accent={accent && HEX.test(accent) ? accent : null} from={from && HEX.test(from) ? from : null} to={to && HEX.test(to) ? to : null} name={name.trim()} slogan={slogan.trim()} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" disabled={!dirty || !valid || update.isPending} onClick={save}>{update.isPending ? "Salvando…" : "Salvar"}</Button>
          <Button variant="ghost" className="gap-1.5 rounded-full text-muted-foreground" onClick={restore}><RotateCcw className="h-3.5 w-3.5" /> Restaurar cores padrão</Button>
        </div>
      </Section>

      <Section icon={ImagePlus} title="Ícone do aplicativo (favicon)" defaultOpen={false}>
        <FaviconUpload />
      </Section>

      <Section icon={BarChart3} title="Integrações" badge="Google Drive">
        <DriveIntegrationCard />
      </Section>

      <Section icon={Link2} title="Link de aprovação" badge={s?.link_preview_image_url ? "Personalizado" : "Padrão"} defaultOpen={false}>
        <LinkPreviewSection />
      </Section>

      <Section icon={Target} title="Dia D (fechamento do mês)" defaultOpen={false}>
        <DiaDSection />
      </Section>

      <Section icon={LogIn} title="Tela de login" defaultOpen={false}>
        <AdminAparenciaPanel hideColors hideLogos embedded />
      </Section>
    </div>
  );
}
