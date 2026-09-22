import { useEffect, useState } from "react";
import { Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_BLOCKS,
  useMyDashboardLayout,
  useUpdateMyDashboardLayout,
  type BlockWidth,
  type DashboardBlockKey,
} from "@/features/meu-painel/hooks/use-dashboard-layout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Item {
  key: DashboardBlockKey;
  visible: boolean;
  width: BlockWidth;
}

export function PersonalizeDashboardDialog({ open, onOpenChange }: Props) {
  const { order: savedOrder, hidden: savedHidden, widths: savedWidths } = useMyDashboardLayout();
  const updateLayout = useUpdateMyDashboardLayout();
  const [items, setItems] = useState<Item[]>([]);
  const [activeDragId, setActiveDragId] = useState<DashboardBlockKey | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!open) return;
    setItems(savedOrder.map((key) => ({ key, visible: !savedHidden.has(key), width: savedWidths[key] ?? "full" })));
  }, [open, savedOrder, savedHidden, savedWidths]);

  const persist = (next: Item[]) => {
    updateLayout.mutate({
      order: next.map((i) => i.key),
      hidden: next.filter((i) => !i.visible).map((i) => i.key),
      widths: Object.fromEntries(next.map((i) => [i.key, i.width])),
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const overId = e.over?.id as DashboardBlockKey | undefined;
    const activeKey = e.active.id as DashboardBlockKey;
    if (!overId || overId === activeKey) return;
    setItems((prev) => {
      const activeIdx = prev.findIndex((i) => i.key === activeKey);
      const overIdx = prev.findIndex((i) => i.key === overId);
      if (activeIdx === -1 || overIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(activeIdx, 1);
      next.splice(overIdx, 0, moved);
      persist(next);
      return next;
    });
  };

  const toggleVisible = (key: DashboardBlockKey) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.key === key ? { ...i, visible: !i.visible } : i));
      persist(next);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalizar página</DialogTitle>
          <DialogDescription>
            Arraste pela alça <GripVertical className="inline h-3.5 w-3.5 -mt-0.5" /> para mudar a ordem e use o{" "}
            <Eye className="inline h-3.5 w-3.5 -mt-0.5" /> para ocultar. Sincroniza com sua conta.
          </DialogDescription>
        </DialogHeader>

        <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id as DashboardBlockKey)} onDragEnd={handleDragEnd}>
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
            <LockedRow label="Boas-vindas e desempenho" description="Sua saudação, ranking mensal e progresso de etapas" />
            {items.map((item) => (
              <PersonalizeRow
                key={item.key}
                item={item}
                isDragging={activeDragId === item.key}
                onToggleVisible={() => toggleVisible(item.key)}
              />
            ))}
          </div>
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}

const BLOCK_INFO: Record<DashboardBlockKey, { label: string; description: string }> = Object.fromEntries(
  DASHBOARD_BLOCKS.map((b) => [b.key, { label: b.label, description: b.description }]),
) as Record<DashboardBlockKey, { label: string; description: string }>;

// Bloco fixo do topo da página (saudação + ranking + progresso): aparece na lista pra
// ficar claro que existe, mas não tem alça nem olho — não dá pra mover nem ocultar.
function LockedRow({ label, description }: { label: string; description: string }) {
  return (
    <div
      title="Este bloco é fixo e não pode ser movido nem ocultado"
      className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3"
    >
      <Lock className="h-5 w-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Fixo</span>
    </div>
  );
}

function PersonalizeRow({
  item,
  isDragging,
  onToggleVisible,
}: {
  item: Item;
  isDragging: boolean;
  onToggleVisible: () => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({ id: item.key });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.key });
  const setRefs = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  const info = BLOCK_INFO[item.key];

  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition",
        isDragging && "opacity-40",
        isOver && !isDragging && "border-primary/50",
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="shrink-0 cursor-grab touch-none text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{info.label}</p>
        <p className="truncate text-xs text-muted-foreground">{info.description}</p>
      </div>

      <button
        type="button"
        onClick={onToggleVisible}
        title={item.visible ? "Ocultar bloco" : "Mostrar bloco"}
        aria-label={item.visible ? "Ocultar bloco" : "Mostrar bloco"}
        className={cn("shrink-0 transition", item.visible ? "text-primary" : "text-muted-foreground hover:text-foreground")}
      >
        {item.visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
      </button>
    </div>
  );
}
