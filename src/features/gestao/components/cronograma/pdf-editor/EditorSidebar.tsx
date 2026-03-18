import { useState } from "react";
import {
  Image, CreditCard, Layers, FileText, ChevronUp, ChevronDown,
  Eye, EyeOff, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BlockId, PdfSettings } from "./types";
import { BLOCK_META } from "./types";

const BLOCK_ICONS: Record<BlockId, React.ReactNode> = {
  cover: <Image className="h-3.5 w-3.5" />,
  cards: <CreditCard className="h-3.5 w-3.5" />,
  carousel: <Layers className="h-3.5 w-3.5" />,
  footer: <FileText className="h-3.5 w-3.5" />,
};

interface Props {
  form: Partial<PdfSettings>;
  blocksOrder: BlockId[];
  blocksEnabled: Record<BlockId, boolean>;
  selectedBlock: BlockId;
  onSelectBlock: (b: BlockId) => void;
  onMoveBlock: (b: BlockId, dir: -1 | 1) => void;
  onToggleBlock: (b: BlockId) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditorSidebar({
  form, blocksOrder, blocksEnabled, selectedBlock,
  onSelectBlock, onMoveBlock, onToggleBlock, onSave, saving,
}: Props) {
  return (
    <div className="flex flex-col h-full border-r border-border/20 bg-card/30">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/15 bg-card/40">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Páginas do PDF
        </h4>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
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
                      {enabled ? <Eye className="h-3 w-3 text-emerald-500" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Save */}
      <div className="p-3 border-t border-border/15">
        <Button size="sm" className="w-full rounded-xl gap-1.5 h-9" onClick={onSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
