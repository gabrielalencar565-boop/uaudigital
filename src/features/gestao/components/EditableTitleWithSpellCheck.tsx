import { useRef, useState, useCallback, useEffect } from "react";
import { useSpellcheck, type SpellError } from "../hooks/use-spellcheck";
import { SpellCheckOverlay } from "./SpellCheckOverlay";
import { SpellSuggestionPopover } from "./SpellSuggestionPopover";

interface Props {
  value: string;
  onSave: (newValue: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Inline-editable title with Word-style spell checking.
 * Always a contentEditable div – no toggling between h1 and input.
 */
export function EditableTitleWithSpellCheck({ value, onSave, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [plainText, setPlainText] = useState(value);
  const { errors, ignoreWord } = useSpellcheck(plainText);
  const [spellPopover, setSpellPopover] = useState<{ error: SpellError; rect: DOMRect } | null>(null);
  const lastSavedRef = useRef(value);

  // Sync external value changes
  useEffect(() => {
    if (ref.current && value !== lastSavedRef.current) {
      ref.current.textContent = value;
      setPlainText(value);
      lastSavedRef.current = value;
    }
  }, [value]);

  // Initialize content
  useEffect(() => {
    if (ref.current && !ref.current.textContent) {
      ref.current.textContent = value;
    }
  }, []);

  const handleInput = useCallback(() => {
    const text = ref.current?.textContent || "";
    setPlainText(text);
    setSpellPopover(null);
  }, []);

  const handleBlur = useCallback(() => {
    const text = (ref.current?.textContent || "").trim();
    setSpellPopover(null);
    if (text && text !== lastSavedRef.current) {
      lastSavedRef.current = text;
      onSave(text);
    }
  }, [onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  // Detect cursor on spell error via selectionchange
  useEffect(() => {
    const checkCursor = () => {
      const sel = window.getSelection();
      if (!sel?.isCollapsed || !ref.current) return;
      if (!ref.current.contains(sel.anchorNode)) {
        setSpellPopover(null);
        return;
      }

      // Calculate plain-text offset
      const walker = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
      let cumOffset = 0;
      let cursorOffset = -1;
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node === sel.anchorNode) {
          cursorOffset = cumOffset + sel.anchorOffset;
          break;
        }
        cumOffset += (node.textContent?.length || 0);
      }

      if (cursorOffset < 0) { setSpellPopover(null); return; }

      const hitError = errors.find(e => cursorOffset >= e.offset && cursorOffset <= e.offset + e.length);
      if (!hitError) { setSpellPopover(null); return; }

      // Get rect for the error word
      const textNodes: { node: Text; start: number; end: number }[] = [];
      const walker2 = document.createTreeWalker(ref.current, NodeFilter.SHOW_TEXT);
      let cum2 = 0;
      let n2: Text | null;
      while ((n2 = walker2.nextNode() as Text | null)) {
        const len = n2.textContent?.length || 0;
        textNodes.push({ node: n2, start: cum2, end: cum2 + len });
        cum2 += len;
      }

      for (const tn of textNodes) {
        if (tn.end <= hitError.offset || tn.start >= hitError.offset + hitError.length) continue;
        const rangeStart = Math.max(hitError.offset - tn.start, 0);
        const rangeEnd = Math.min(hitError.offset + hitError.length - tn.start, tn.node.textContent?.length || 0);
        try {
          const range = document.createRange();
          range.setStart(tn.node, rangeStart);
          range.setEnd(tn.node, rangeEnd);
          setSpellPopover({ error: hitError, rect: range.getBoundingClientRect() });
          return;
        } catch { /* ignore */ }
      }
      setSpellPopover(null);
    };

    document.addEventListener("selectionchange", checkCursor);
    return () => document.removeEventListener("selectionchange", checkCursor);
  }, [errors]);

  const handleSelect = useCallback((replacement: string) => {
    if (!spellPopover || !ref.current) return;
    const { error } = spellPopover;
    const text = ref.current.textContent || "";
    const newText = text.slice(0, error.offset) + replacement + text.slice(error.offset + error.length);
    ref.current.textContent = newText;
    setPlainText(newText);
    lastSavedRef.current = newText;
    onSave(newText);
    setSpellPopover(null);
  }, [spellPopover, onSave]);

  const handleIgnore = useCallback(() => {
    if (!spellPopover) return;
    ignoreWord(spellPopover.error.word);
    setSpellPopover(null);
  }, [spellPopover, ignoreWord]);

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={className}
        spellCheck={false}
        style={{ outline: "none", minHeight: "1.5em", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      />
      {!disabled && <SpellCheckOverlay editorRef={ref as any} errors={errors} />}
      {spellPopover && (
        <SpellSuggestionPopover
          error={spellPopover.error}
          anchorRect={spellPopover.rect}
          onSelect={handleSelect}
          onIgnore={handleIgnore}
          onClose={() => setSpellPopover(null)}
        />
      )}
    </div>
  );
}
