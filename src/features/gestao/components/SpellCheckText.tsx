import { useState, useCallback } from "react";
import { useSpellcheck, type SpellError } from "../hooks/use-spellcheck";
import { SpellSuggestionPopover } from "./SpellSuggestionPopover";

interface Props {
  text: string;
  className?: string;
  onClick?: () => void;
  onCorrect?: (corrected: string) => void;
}

/**
 * Renders plain text with wavy red underlines on spelling errors.
 * Clicking an error word shows a suggestion popover.
 * onCorrect is called with the full corrected string when a suggestion is applied.
 */
export function SpellCheckText({ text, className, onClick, onCorrect }: Props) {
  const { errors, ignoreWord } = useSpellcheck(text);
  const [popover, setPopover] = useState<{ error: SpellError; rect: DOMRect } | null>(null);

  const handleErrorClick = useCallback((e: React.MouseEvent, error: SpellError) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopover({ error, rect });
  }, []);

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

  if (errors.length === 0) {
    return <span className={className} onClick={onClick}>{text}</span>;
  }

  // Build segments: normal text + error spans
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  const sorted = [...errors].sort((a, b) => a.offset - b.offset);

  for (const err of sorted) {
    if (err.offset > lastIndex) {
      segments.push(<span key={`t-${lastIndex}`} onClick={onClick} className="cursor-text">{text.slice(lastIndex, err.offset)}</span>);
    }
    segments.push(
      <span
        key={`e-${err.offset}`}
        className="cursor-pointer"
        style={{
          textDecoration: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 2.5 Q1 0 2 2.5 Q3 5 4 2.5' stroke='%23ef4444' fill='none' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat-x",
          backgroundPosition: "bottom",
          backgroundSize: "4px 3px",
          paddingBottom: "2px",
        }}
        onClick={(e) => handleErrorClick(e, err)}
      >
        {text.slice(err.offset, err.offset + err.length)}
      </span>
    );
    lastIndex = err.offset + err.length;
  }

  if (lastIndex < text.length) {
    segments.push(<span key={`t-${lastIndex}`} onClick={onClick} className="cursor-text">{text.slice(lastIndex)}</span>);
  }

  return (
    <>
      <span className={className} onClick={onClick}>
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
