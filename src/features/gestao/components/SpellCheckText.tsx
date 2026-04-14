import { useState, useCallback, useRef, useEffect } from "react";
import { useSpellcheck, type SpellError } from "../hooks/use-spellcheck";
import { SpellSuggestionPopover } from "./SpellSuggestionPopover";

interface Props {
  text: string;
  className?: string;
  onClick?: () => void;
  onCorrect?: (corrected: string) => void;
}

/**
 * Renders plain text with wavy red underlines on spelling errors (Word-style).
 * Text is NOT split into interactive spans – the entire text remains a single
 * clickable element so parent handlers (like entering edit mode) work normally.
 *
 * When the user right-clicks or double-clicks on an error word, a suggestion
 * popover appears. Single click always goes to the parent onClick (edit mode).
 */
export function SpellCheckText({ text, className, onClick, onCorrect }: Props) {
  const { errors, ignoreWord } = useSpellcheck(text);
  const [popover, setPopover] = useState<{ error: SpellError; rect: DOMRect } | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  // Find which error word (if any) is at a given character offset
  const findErrorAtOffset = useCallback((offset: number) => {
    return errors.find(e => offset >= e.offset && offset < e.offset + e.length) || null;
  }, [errors]);

  // Get character offset from a mouse event
  const getOffsetFromEvent = useCallback((e: React.MouseEvent) => {
    const el = spanRef.current;
    if (!el) return -1;

    // Use caretPositionFromPoint or caretRangeAtPoint
    let range: Range | null = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(e.clientX, e.clientY);
    }
    if (!range) return -1;

    // Calculate plain text offset
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let cumOffset = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node === range.startContainer) {
        return cumOffset + range.startOffset;
      }
      cumOffset += (node.textContent?.length || 0);
    }
    return -1;
  }, []);

  // Get the DOMRect for an error word
  const getRectForError = useCallback((error: SpellError): DOMRect | null => {
    const el = spanRef.current;
    if (!el) return null;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let cumOffset = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.textContent?.length || 0;
      if (cumOffset + len > error.offset) {
        const localStart = Math.max(error.offset - cumOffset, 0);
        const localEnd = Math.min(error.offset + error.length - cumOffset, len);
        try {
          const r = document.createRange();
          r.setStart(node, localStart);
          r.setEnd(node, localEnd);
          return r.getBoundingClientRect();
        } catch {
          return null;
        }
      }
      cumOffset += len;
    }
    return null;
  }, []);

  // Right-click on error word shows popover
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const offset = getOffsetFromEvent(e);
    if (offset < 0) return;
    const error = findErrorAtOffset(offset);
    if (!error || !onCorrect) return;

    e.preventDefault();
    const rect = getRectForError(error);
    if (rect) setPopover({ error, rect });
  }, [getOffsetFromEvent, findErrorAtOffset, getRectForError, onCorrect]);

  const handleSelect = useCallback((replacement: string) => {
    if (!popover || !onCorrect) return;
    const { error } = popover;
    const corrected = text.slice(0, error.offset) + replacement + text.slice(error.offset + error.length);
    onCorrect(corrected);
    setPopover(null);
  }, [popover, text, onCorrect]);

  const handleIgnore = useCallback(() => {
    if (!popover) return;
    ignoreWord(popover.error.word);
    setPopover(null);
  }, [popover, ignoreWord]);

  // Build CSS for wavy underlines using text-decoration on individual segments
  // But since we can't split into spans (to keep click behavior), use an overlay approach
  if (errors.length === 0) {
    return <span ref={spanRef} className={className} onClick={onClick}>{text}</span>;
  }

  // We render the text as segments but keep onClick on ALL of them (both error and non-error)
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  const sorted = [...errors].sort((a, b) => a.offset - b.offset);

  for (const err of sorted) {
    if (err.offset > lastIndex) {
      segments.push(
        <span key={`t-${lastIndex}`}>{text.slice(lastIndex, err.offset)}</span>
      );
    }
    segments.push(
      <span
        key={`e-${err.offset}`}
        style={{
          textDecoration: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 2.5 Q1 0 2 2.5 Q3 5 4 2.5' stroke='%23ef4444' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat-x",
          backgroundPosition: "bottom",
          backgroundSize: "4px 3px",
          paddingBottom: "2px",
        }}
        title={err.message}
      >
        {text.slice(err.offset, err.offset + err.length)}
      </span>
    );
    lastIndex = err.offset + err.length;
  }

  if (lastIndex < text.length) {
    segments.push(
      <span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>
    );
  }

  return (
    <>
      <span
        ref={spanRef}
        className={className}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        style={{ cursor: "text" }}
      >
        {segments}
      </span>
      {popover && (
        <SpellSuggestionPopover
          error={popover.error}
          anchorRect={popover.rect}
          onSelect={handleSelect}
          onIgnore={handleIgnore}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
