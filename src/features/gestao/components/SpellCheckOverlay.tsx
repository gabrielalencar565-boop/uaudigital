import { useEffect, useState, useCallback, RefObject } from "react";
import type { SpellError } from "../hooks/use-spellcheck";

interface ErrorRect {
  top: number;
  left: number;
  width: number;
  height: number;
  error: SpellError;
}

interface Props {
  editorRef: RefObject<HTMLDivElement>;
  errors: SpellError[];
  onErrorClick: (error: SpellError, rect: DOMRect) => void;
}

function findTextNodesIn(node: Node): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) result.push(n as Text);
  return result;
}

export function SpellCheckOverlay({ editorRef, errors, onErrorClick }: Props) {
  const [rects, setRects] = useState<ErrorRect[]>([]);

  const recalc = useCallback(() => {
    const el = editorRef.current;
    if (!el || errors.length === 0) { setRects([]); return; }

    const editorRect = el.getBoundingClientRect();
    const textNodes = findTextNodesIn(el);

    // Build a map of cumulative offsets for text nodes (plain text offset)
    let cumOffset = 0;
    const nodeMap: { node: Text; start: number; end: number }[] = [];
    for (const tn of textNodes) {
      const len = tn.textContent?.length || 0;
      nodeMap.push({ node: tn, start: cumOffset, end: cumOffset + len });
      cumOffset += len;
    }

    const newRects: ErrorRect[] = [];

    for (const err of errors) {
      const errStart = err.offset;
      const errEnd = err.offset + err.length;

      // Find which text nodes overlap this error
      for (const nm of nodeMap) {
        if (nm.end <= errStart || nm.start >= errEnd) continue;

        const rangeStart = Math.max(errStart - nm.start, 0);
        const rangeEnd = Math.min(errEnd - nm.start, nm.node.textContent?.length || 0);

        try {
          const range = document.createRange();
          range.setStart(nm.node, rangeStart);
          range.setEnd(nm.node, rangeEnd);
          const clientRects = range.getClientRects();

          for (let i = 0; i < clientRects.length; i++) {
            const r = clientRects[i];
            newRects.push({
              top: r.top - editorRect.top + el.scrollTop,
              left: r.left - editorRect.left + el.scrollLeft,
              width: r.width,
              height: r.height,
              error: err,
            });
          }
        } catch {
          // Range API can fail if offsets are invalid
        }
      }
    }

    setRects(newRects);
  }, [editorRef, errors]);

  useEffect(() => {
    recalc();
  }, [recalc]);

  // Recalculate on scroll/resize
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    el.addEventListener("scroll", recalc);
    window.addEventListener("resize", recalc);

    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", recalc);
      window.removeEventListener("resize", recalc);
    };
  }, [editorRef, recalc]);

  if (rects.length === 0) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-lg"
      style={{ pointerEvents: "none", zIndex: 1 }}
    >
      {rects.map((r, i) => (
        <div
          key={`${r.error.offset}-${r.error.length}-${i}`}
          className="absolute cursor-pointer"
          style={{
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            const domRect = (e.target as HTMLElement).getBoundingClientRect();
            onErrorClick(r.error, domRect);
          }}
        >
          {/* Wavy underline at the bottom */}
          <div
            className="absolute bottom-0 left-0 w-full"
            style={{
              height: 3,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 2.5 Q1 0 2 2.5 Q3 5 4 2.5' stroke='%23ef4444' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
              backgroundRepeat: "repeat-x",
              backgroundSize: "4px 3px",
            }}
          />
        </div>
      ))}
    </div>
  );
}
