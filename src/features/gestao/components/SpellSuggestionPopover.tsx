import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
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

  const bestSuggestion = error.suggestions[0];
  if (!bestSuggestion) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.top - 44,
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - 70),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="flex items-center gap-1 rounded-lg border border-border/40 bg-popover shadow-xl px-2 py-1.5 animate-in fade-in-0 zoom-in-95 duration-100"
      onMouseDown={(e) => e.preventDefault()}
      title={error.message}
    >
      <button
        type="button"
        onClick={() => onSelect(bestSuggestion)}
        className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
        title={`Corrigir para "${bestSuggestion}"`}
      >
        <Check className="h-3.5 w-3.5" />
        <span>{bestSuggestion}</span>
      </button>
      <button
        type="button"
        onClick={onIgnore}
        className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        title="Ignorar este erro"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
