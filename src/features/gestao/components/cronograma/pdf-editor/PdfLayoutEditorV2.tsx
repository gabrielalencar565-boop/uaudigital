import { useState, useEffect, useCallback } from "react";
import { Save, FileDown, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PdfSettings, BlockId, LayoutPoint } from "./types";
import { ALL_BLOCKS, LAYOUT_KEYS_BY_BLOCK, clamp, PDF_W, PDF_H } from "./types";
import { usePdfSettings, useUpdatePdfSettings } from "./use-pdf-settings";
import { EditorSidebar } from "./EditorSidebar";
import { PropertiesPanel } from "./PropertiesPanel";
import {
  PreviewCover, PreviewPostPage, PreviewCarouselPage, PreviewFooter, ScaledPreview
} from "./PreviewPages";

const BLOCK_LABELS: Record<BlockId, string> = {
  cover: "Capa",
  cards: "Posts",
  carousel: "Carrossel",
  footer: "Rodapé",
};

export function PdfLayoutEditor() {
  const settingsQ = usePdfSettings();
  const updateSettings = useUpdatePdfSettings();
  const [form, setForm] = useState<Partial<PdfSettings>>({});
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("cover");
  const [fullPreview, setFullPreview] = useState(false);

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const blocksOrder = (form.blocks_order ?? ["cover", "cards", "carousel", "footer"]).filter(
    (b): b is BlockId => ALL_BLOCKS.includes(b as BlockId)
  );
  if (!blocksOrder.includes("carousel")) blocksOrder.splice(Math.max(blocksOrder.indexOf("cards") + 1, 1), 0, "carousel");

  const blocksEnabled = { cover: true, cards: true, carousel: true, footer: true, ...(form.blocks_enabled ?? {}) } as Record<BlockId, boolean>;
  const enabledBlocks = blocksOrder.filter(b => blocksEnabled[b]);

  const handleSave = () => {
    if (!form.id) return;
    updateSettings.mutate(form as PdfSettings);
  };

  const moveBlock = useCallback((blockId: BlockId, dir: -1 | 1) => {
    setForm(prev => {
      const order = [...(prev.blocks_order ?? ["cover", "cards", "carousel", "footer"])].filter(
        (b): b is BlockId => ALL_BLOCKS.includes(b as BlockId)
      );
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
      const enabled = { cover: true, cards: true, carousel: true, footer: true, ...(prev.blocks_enabled ?? {}) } as Record<BlockId, boolean>;
      enabled[blockId] = !enabled[blockId];
      return { ...prev, blocks_enabled: enabled };
    });
  }, []);

  const moveLayoutNode = useCallback((key: string, point: LayoutPoint) => {
    setForm(prev => ({
      ...prev,
      layout_overrides: {
        ...((prev.layout_overrides as Record<string, LayoutPoint> | undefined) ?? {}),
        [key]: point,
      },
    }));
  }, []);

  const nudgeCardImageWidth = useCallback((delta: number) => {
    setForm(prev => ({
      ...prev,
      card_image_width_pct: clamp((prev.card_image_width_pct ?? 45) + delta, 25, 65),
    }));
  }, []);

  const resetSelectedBlockLayout = useCallback(() => {
    setForm(prev => {
      const current = { ...((prev.layout_overrides as Record<string, LayoutPoint> | undefined) ?? {}) };
      for (const key of LAYOUT_KEYS_BY_BLOCK[selectedBlock]) {
        delete current[key];
      }
      return { ...prev, layout_overrides: current };
    });
    toast.success("Posição resetada.");
  }, [selectedBlock]);

  if (settingsQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando editor...</span>
        </div>
      </div>
    );
  }

  const renderPreviewBlock = (blockId: BlockId) => {
    const editable = selectedBlock === blockId;
    switch (blockId) {
      case "cover":
        return (
          <ScaledPreview key="cover" label="Capa" pageNum={enabledBlocks.indexOf("cover") + 1} isSelected={editable} onClick={() => setSelectedBlock("cover")}>
            <PreviewCover form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
      case "cards":
        return (
          <ScaledPreview key="cards" label="Post padrão" pageNum={enabledBlocks.indexOf("cards") + 1} isSelected={editable} onClick={() => setSelectedBlock("cards")}>
            <PreviewPostPage form={form} editable={editable} onMoveNode={moveLayoutNode} index={0} onResizeImage={nudgeCardImageWidth} />
          </ScaledPreview>
        );
      case "carousel":
        return (
          <ScaledPreview key="carousel" label={`Carrossel (${form.carousel_cols ?? 4}×${form.carousel_rows ?? 2})`} pageNum={enabledBlocks.indexOf("carousel") + 1} isSelected={editable} onClick={() => setSelectedBlock("carousel")}>
            <PreviewCarouselPage form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
      case "footer":
        return (
          <ScaledPreview key="footer" label="Rodapé" pageNum={enabledBlocks.indexOf("footer") + 1} isSelected={editable} onClick={() => setSelectedBlock("footer")}>
            <PreviewFooter form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden" style={{ animation: "fadeUp 0.6s ease-out forwards" }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-card/60">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Editor de Layout PDF</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">A4 Paisagem · Arraste elementos para reposicionar</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-xl h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => setFullPreview(true)}>
              <Eye className="h-3.5 w-3.5" />
              Pré-visualizar
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs gap-1.5">
              <FileDown className="h-3.5 w-3.5" />
              Exportar PDF
            </Button>
            <Button size="sm" className="rounded-xl h-8 text-xs gap-1.5" onClick={handleSave} disabled={updateSettings.isPending}>
              <Save className="h-3.5 w-3.5" />
              {updateSettings.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* ── Body: 3-panel layout ── */}
        <div className="flex" style={{ height: "calc(100vh - 220px)", minHeight: 520 }}>
          {/* Left: Block list */}
          <div className="w-[220px] shrink-0">
            <EditorSidebar
              form={form}
              blocksOrder={blocksOrder}
              blocksEnabled={blocksEnabled}
              selectedBlock={selectedBlock}
              onSelectBlock={setSelectedBlock}
              onMoveBlock={moveBlock}
              onToggleBlock={toggleBlock}
              onSave={handleSave}
              saving={updateSettings.isPending}
            />
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 min-w-0 bg-muted/5">
            <ScrollArea className="h-full">
              <div className="px-6 py-5">
                {/* Page tab bar */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/20 border border-border/10">
                    {enabledBlocks.map((blockId) => (
                      <button
                        key={blockId}
                        onClick={() => setSelectedBlock(blockId)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                          selectedBlock === blockId
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                      >
                        {BLOCK_LABELS[blockId]}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {enabledBlocks.length} {enabledBlocks.length === 1 ? "página" : "páginas"}
                  </span>
                </div>

                {/* Preview pages */}
                <div className="space-y-5">
                  {enabledBlocks.map((blockId) => renderPreviewBlock(blockId))}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right: Properties + Templates */}
          <div className="w-[280px] shrink-0">
            <PropertiesPanel
              form={form}
              setForm={setForm}
              selectedBlock={selectedBlock}
              onResetBlockLayout={resetSelectedBlockLayout}
            />
          </div>
        </div>
      </div>

      {/* ── Fullscreen Preview Overlay ── */}
      {fullPreview && (
        <FullPreviewOverlay
          enabledBlocks={enabledBlocks}
          form={form}
          onClose={() => setFullPreview(false)}
        />
      )}
    </>
  );
}

/* ─── Fullscreen Preview ─── */
function FullPreviewOverlay({ enabledBlocks, form, onClose }: {
  enabledBlocks: BlockId[];
  form: Partial<PdfSettings>;
  onClose: () => void;
}) {
  const [pageIdx, setPageIdx] = useState(0);
  const [scale, setScale] = useState(0.5);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const currentBlock = enabledBlocks[pageIdx] ?? enabledBlocks[0];

  useEffect(() => {
    if (!containerEl) return;
    const update = () => {
      const availW = containerEl.clientWidth - 80;
      const availH = containerEl.clientHeight - 80;
      if (availW <= 0 || availH <= 0) return;
      setScale(Math.max(0.1, Math.min(1, Math.min(availW / PDF_W, availH / PDF_H))));
    };
    const ro = new ResizeObserver(update);
    ro.observe(containerEl);
    update();
    return () => ro.disconnect();
  }, [containerEl]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setPageIdx(i => Math.min(i + 1, enabledBlocks.length - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setPageIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabledBlocks.length, onClose]);

  const noop = () => {};

  const renderPage = (blockId: BlockId) => {
    switch (blockId) {
      case "cover": return <PreviewCover form={form} editable={false} onMoveNode={noop} />;
      case "cards": return <PreviewPostPage form={form} editable={false} onMoveNode={noop} index={0} />;
      case "carousel": return <PreviewCarouselPage form={form} editable={false} onMoveNode={noop} />;
      case "footer": return <PreviewFooter form={form} editable={false} onMoveNode={noop} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-6 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {enabledBlocks.map((b, i) => (
            <button key={b} onClick={() => setPageIdx(i)} className={cn("px-3 py-1 rounded-lg text-[11px] font-medium transition-all", i === pageIdx ? "bg-white text-black" : "text-white/60 hover:text-white/90")}>
              {BLOCK_LABELS[b]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-[11px] tabular-nums">{Math.round(scale * 100)}%</span>
          <span className="text-white/50 text-[11px]">Página {pageIdx + 1} de {enabledBlocks.length}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={setContainerEl} className="flex-1 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <div className="rounded-lg overflow-hidden shrink-0" style={{ width: PDF_W, height: PDF_H, transform: `scale(${scale})`, transformOrigin: "center center", fontFamily: '"Bricolage Grotesque", "Segoe UI", sans-serif', boxShadow: "0 16px 64px -16px rgba(0,0,0,0.5)" }}>
          {renderPage(currentBlock)}
        </div>
      </div>
      <div className="text-center py-3 text-white/30 text-[10px] shrink-0">← → para navegar · Esc para fechar</div>
    </div>
  );
}
