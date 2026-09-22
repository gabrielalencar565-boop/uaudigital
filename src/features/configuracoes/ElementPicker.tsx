import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Lightweight "click to point at the problem" picker — hover highlights whatever's under
// the cursor, click captures a short description of it (tag, classes, visible text, a
// shallow selector path) so the report carries something more useful than "a screen
// somewhere is broken". No screenshot library involved on purpose: the person can already
// attach an actual image separately via ReportProblemDialog's anexo button.

export interface PickedElementInfo {
  tag: string;
  id?: string;
  classes: string[];
  text: string;
  selector: string;
  robustSelector: string;
  rect: { x: number; y: number; width: number; height: number };
}

// Seletor por posição (nth-of-type encadeado, até 8 níveis, ou corta cedo num id) — pensado
// pra "ache esse elemento de novo depois" (ElementHighlightWatcher), não só pra descrever.
// Funciona bem pra chrome estático (botões, cabeçalhos, cards fixos); uma linha dentro de
// uma lista dinâmica pode não bater se a lista mudar de ordem/tamanho — risco aceito, é
// melhor esforço, e quem escolhe o elemento normalmente aponta pra algo fixo na tela.
function buildRobustSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 8) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const parent: Element | null = node.parentElement;
    if (!parent) {
      parts.unshift(node.tagName.toLowerCase());
      break;
    }
    const sameTagSiblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
    const index = sameTagSiblings.indexOf(node) + 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
    node = parent;
    depth++;
  }
  return parts.join(" > ");
}

function describeElement(el: Element): PickedElementInfo {
  const tag = el.tagName.toLowerCase();
  const id = el.id || undefined;
  const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 4) : [];
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
  const rect = el.getBoundingClientRect();

  const segments: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 4) {
    let seg = node.tagName.toLowerCase();
    if (node.id) {
      segments.unshift(`${seg}#${node.id}`);
      break;
    }
    const firstClass = typeof node.className === "string" ? node.className.trim().split(/\s+/)[0] : "";
    if (firstClass) seg += `.${firstClass}`;
    segments.unshift(seg);
    node = node.parentElement;
    depth++;
  }

  return {
    tag,
    id,
    classes,
    text,
    selector: segments.join(" > "),
    robustSelector: buildRobustSelector(el),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
  };
}

interface Props {
  active: boolean;
  onSelect: (info: PickedElementInfo) => void;
  onCancel: () => void;
}

export function ElementPicker({ active, onSelect, onCancel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [hoverEl, setHoverEl] = useState<Element | null>(null);

  useEffect(() => {
    if (!active) return;

    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const handleMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || rootRef.current?.contains(el)) {
        setHoverRect(null);
        setHoverEl(null);
        return;
      }
      setHoverEl(el);
      setHoverRect(el.getBoundingClientRect());
    };

    const handleClick = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return; // clicks on our own bar (Cancelar) behave normally
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) onSelect(describeElement(el));
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("mousemove", handleMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousemove", handleMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [active, onSelect, onCancel]);

  if (!active) return null;

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] cursor-crosshair">
      <div className="pointer-events-none absolute inset-0 bg-black/10" />

      {hoverRect && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/10"
          style={{ top: hoverRect.top, left: hoverRect.left, width: hoverRect.width, height: hoverRect.height }}
        />
      )}

      {hoverEl && hoverRect && (
        <div
          className="pointer-events-none absolute max-w-xs truncate rounded-md bg-foreground px-2 py-1 text-xs font-mono text-background shadow-lg"
          style={{ top: Math.max(4, hoverRect.top - 26), left: Math.max(4, hoverRect.left) }}
        >
          {hoverEl.tagName.toLowerCase()}
          {typeof (hoverEl as HTMLElement).className === "string" && (hoverEl as HTMLElement).className.trim()
            ? `.${(hoverEl as HTMLElement).className.trim().split(/\s+/)[0]}`
            : ""}
        </div>
      )}

      <div className="pointer-events-auto fixed left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg">
        <span className="text-foreground">Clique no elemento com o problema</span>
        <button
          type="button"
          onClick={onCancel}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-3 w-3" /> Cancelar
        </button>
      </div>
    </div>
  );
}
