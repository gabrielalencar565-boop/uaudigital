import { useMemo, useState } from "react";
import { ArrowRight, MousePointerClick, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MainTab } from "@/components/layout/UauSidebarShell";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { setPendingHighlight } from "@/lib/pending-highlight-store";
import { ElementPicker, type PickedElementInfo } from "@/features/configuracoes/ElementPicker";
import {
  useChangelogEntries,
  useCreateChangelogEntry,
  useDeleteChangelogEntry,
  type ChangelogEntry,
} from "@/features/ajuda/hooks/use-help-data";

const TARGET_TABS: { value: MainTab; label: string }[] = [
  { value: "meu_painel", label: "Meu Painel" },
  { value: "agenda_gestao", label: "Agenda" },
  { value: "pauta_pessoas", label: "Pauta" },
  { value: "calendario_publicacao", label: "Cronograma" },
  { value: "visao_do_dia", label: "Visão do Dia" },
  { value: "magic2", label: "Magic Number" },
  { value: "desempenho", label: "The Best" },
  { value: "visao_geral_projetos", label: "Painel de Squads" },
  { value: "financeiro", label: "Financeiro" },
  { value: "recompensas", label: "Uau XP" },
  { value: "comercial", label: "Comercial" },
  { value: "ajuda", label: "Ajuda" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    ", " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function goToTarget(tab: string, targetSelector: string | null) {
  if (targetSelector) setPendingHighlight(targetSelector);
  window.dispatchEvent(new CustomEvent("uau:switch-tab", { detail: { tab } }));
}

function elementSummary(el: PickedElementInfo) {
  const cls = el.classes[0] ? `.${el.classes[0]}` : "";
  const idPart = el.id ? `#${el.id}` : "";
  return `<${el.tag}${idPart}${cls}>${el.text ? ` ${el.text.slice(0, 40)}` : ""}`;
}

export function ChangelogSection({ isDeveloper }: { isDeveloper: boolean }) {
  const entriesQ = useChangelogEntries();
  const createEntry = useCreateChangelogEntry();
  const deleteEntry = useDeleteChangelogEntry();
  const updateAppSettings = useUpdateAppSettings();
  const appSettingsQ = useAppSettings();
  const entries = entriesQ.data ?? [];

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaTarget, setCtaTarget] = useState<string>("__none__");
  const [targetElement, setTargetElement] = useState<PickedElementInfo | null>(null);
  const [pickerActive, setPickerActive] = useState(false);
  const [publishAsBanner, setPublishAsBanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [entries]);

  const filtered = activeCategory ? entries.filter((e) => e.category === activeCategory) : entries;

  const resetForm = () => {
    setCategory("");
    setTitle("");
    setDescription("");
    setCtaLabel("");
    setCtaTarget("__none__");
    setTargetElement(null);
    setPublishAsBanner(false);
  };

  const handleCreate = async () => {
    if (!category.trim() || !title.trim() || !description.trim()) {
      toast.error("Preencha categoria, título e descrição");
      return;
    }
    setSaving(true);
    try {
      const targetTab = ctaTarget === "__none__" ? null : ctaTarget;
      const targetSelector = targetElement?.robustSelector ?? null;

      await createEntry.mutateAsync({
        category: category.trim(),
        title: title.trim(),
        description: description.trim(),
        cta_label: ctaLabel.trim() || null,
        cta_target_tab: targetTab,
        cta_target_selector: targetSelector,
        publish_as_banner: publishAsBanner,
      });

      // "Publicar pra todo mundo" reaproveita o mesmo sistema de aviso no topo que já existe
      // (Configurações → Administração → Novidades) em vez de criar um segundo mecanismo —
      // essa atualização vira o aviso ativo, com o mesmo alvo (aba + elemento) do card.
      if (publishAsBanner) {
        await updateAppSettings.mutateAsync({
          whats_new_enabled: true,
          whats_new_title: title.trim(),
          whats_new_description: description.trim(),
          whats_new_target_tab: targetTab,
          whats_new_target_action: null,
          whats_new_target_selector: targetSelector,
          whats_new_published_at: new Date().toISOString(),
        });
      }

      toast.success(publishAsBanner ? "Atualização publicada e avisada no topo!" : "Atualização publicada!");
      resetForm();
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao publicar atualização");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              activeCategory === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Todas ({entries.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setActiveCategory(c.name)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                activeCategory === c.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
        {isDeveloper && (
          <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova atualização
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-10 text-center text-sm text-muted-foreground">
          {entries.length === 0 ? "Nenhuma atualização publicada ainda." : "Nenhuma atualização nessa categoria."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <ChangelogCard key={entry.id} entry={entry} isDeveloper={isDeveloper} onDelete={() => deleteEntry.mutate(entry.id)} />
          ))}
        </div>
      )}

      <Dialog open={formOpen && !pickerActive} onOpenChange={(v) => { setFormOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova atualização</DialogTitle>
            <DialogDescription>Aparece pra todo mundo na Central de Ajuda, mais recente primeiro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Correções e Melhorias" />
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Automações bem mais completas" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[100px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Texto do botão (opcional)</Label>
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ver como funciona" />
              </div>
              <div className="space-y-1.5">
                <Label>Ao clicar, levar para</Label>
                <Select value={ctaTarget} onValueChange={setCtaTarget}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma aba</SelectItem>
                    {TARGET_TABS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetElement ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <MousePointerClick className="h-4 w-4 shrink-0 text-primary" />
                <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{elementSummary(targetElement)}</code>
                <button
                  type="button"
                  onClick={() => setTargetElement(null)}
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  aria-label="Remover elemento escolhido"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPickerActive(true)}>
                <MousePointerClick className="h-3.5 w-3.5" />
                Selecionar elemento na tela (opcional)
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Depois de trocar de aba, a tela rola até esse elemento e destaca ele por alguns segundos.
            </p>

            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Publicar também como aviso no topo</p>
                <p className="text-xs text-muted-foreground">
                  {appSettingsQ.data?.whats_new_enabled
                    ? "Substitui o aviso atual pra todo mundo."
                    : "Sem isso, só aparece aqui na lista de Atualizações."}
                </p>
              </div>
              <Switch checked={publishAsBanner} onCheckedChange={setPublishAsBanner} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ElementPicker
        active={pickerActive}
        onSelect={(info) => {
          setTargetElement(info);
          setPickerActive(false);
        }}
        onCancel={() => setPickerActive(false)}
      />
    </div>
  );
}

function ChangelogCard({ entry, isDeveloper, onDelete }: { entry: ChangelogEntry; isDeveloper: boolean; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {entry.category}
          </span>
          <span className="text-xs text-muted-foreground">{formatDate(entry.published_at)}</span>
        </div>
        {isDeveloper && (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 text-muted-foreground transition hover:text-destructive"
            aria-label="Remover atualização"
            title="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{entry.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{entry.description}</p>
      {entry.cta_label && (
        <button
          type="button"
          onClick={() => entry.cta_target_tab && goToTarget(entry.cta_target_tab, entry.cta_target_selector)}
          disabled={!entry.cta_target_tab}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/70 disabled:cursor-default disabled:opacity-70"
        >
          {entry.cta_label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
