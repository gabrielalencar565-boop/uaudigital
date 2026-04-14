import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SpellCheck, X, Ban } from "lucide-react";
import type { SpellError } from "../hooks/use-spellcheck";

interface Props {
  error: SpellError;
  anchorRect: DOMRect;
  onSelect: (replacement: string) => void;
  onIgnore: () => void;
  onClose: () => void;
}

export function SpellSuggestionPopover({ error, anchorRect, onSelect, onIgnore, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Estimate popover height (~200px) and position above the word
  const popoverHeight = 220;
  const fitsAbove = anchorRect.top - popoverHeight - 6 > 0;

  const style: React.CSSProperties = {
    position: "fixed",
    top: fitsAbove ? anchorRect.top - popoverHeight - 6 : anchorRect.bottom + 6,
    left: Math.max(8, Math.min(anchorRect.left - 40, window.innerWidth - 280)),
    zIndex: 9999,
  };

  return (
    <div ref={ref} style={style} className="w-64 rounded-xl border border-border/40 bg-popover shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <SpellCheck className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Correção</span>
        </div>
        <button type="button" onClick={onClose} className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Error message */}
      <div className="px-3 py-2 border-b border-border/20">
        <p className="text-xs text-muted-foreground leading-relaxed">{error.message}</p>
        <p className="text-xs font-medium text-destructive mt-1">"{error.word}"</p>
      </div>

      {/* Suggestions */}
      {error.suggestions.length > 0 && (
        <div className="p-1">
          {error.suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(s)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
                i === 0 && "font-medium text-primary"
              )}
            >
              <SpellCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left">{s}</span>
            </button>
          ))}
        </div>
      )}

      {/* Ignore */}
      <div className="border-t border-border/20 p-1">
        <button
          type="button"
          onClick={onIgnore}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Ban className="h-3.5 w-3.5 shrink-0" />
          <span>Ignorar</span>
        </button>
      </div>
    </div>
  );
}
