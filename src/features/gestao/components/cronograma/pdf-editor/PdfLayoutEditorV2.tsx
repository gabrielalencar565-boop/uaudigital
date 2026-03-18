import { useState, useEffect, useCallback } from "react";
import { Save, FileDown, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PdfSettings, BlockId, LayoutPoint } from "./types";
import { ALL_BLOCKS, LAYOUT_KEYS_BY_BLOCK, clamp } from "./types";
import { usePdfSettings, useUpdatePdfSettings } from "./use-pdf-settings";
import { EditorSidebar } from "./EditorSidebar";
import {
  PreviewCover, PreviewPostPage, PreviewCarouselPage, PreviewFooter, ScaledPreview
} from "./PreviewPages";

const BLOCK_LABELS: Record<BlockId, string> = {
  cover: "Capa",
  cards: "Posts",
  carousel: "Carrossel",
  footer: "Rodapé",
};

import { PDF_W, PDF_H } from "./types";

export function PdfLayoutEditor() {
  const settingsQ = usePdfSettings();
  const updateSettings = useUpdatePdfSettings();
  const [form, setForm] = useState<Partial<PdfSettings>>({});
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("cover");
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
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
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden" style={{ animation: "fadeUp 0.6s ease-out forwards" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/20 bg-card/60">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-bold tracking-tight">Editor de Layout PDF</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">A4 Paisagem · Arraste elementos para reposicionar</p>
          </div>
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

      {/* ── Body: sidebar + canvas ── */}
      <div className="flex" style={{ height: "calc(100vh - 220px)", minHeight: 520 }}>
        {/* Sidebar */}
        <div className="w-[272px] shrink-0">
          <EditorSidebar
            form={form}
            setForm={setForm}
            blocksOrder={blocksOrder}
            blocksEnabled={blocksEnabled}
            selectedBlock={selectedBlock}
            onSelectBlock={setSelectedBlock}
            onMoveBlock={moveBlock}
            onToggleBlock={toggleBlock}
            onResetBlockLayout={resetSelectedBlockLayout}
            onSave={handleSave}
            saving={updateSettings.isPending}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 min-w-0 bg-muted/5">
          <ScrollArea className="h-full">
            <div className="px-8 py-6">
              {/* Page tab bar */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/20 border border-border/10">
                  {enabledBlocks.map((blockId, i) => (
                    <button
                      key={blockId}
                      onClick={() => { setSelectedBlock(blockId); setPreviewPageIndex(i); }}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
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
              <div className="space-y-6">
                {enabledBlocks.map((blockId) => renderPreviewBlock(blockId))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
