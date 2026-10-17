import { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = ["🧹", "🧽", "🧼", "🧴", "🪣", "🚿", "🚽", "🧺", "🗑️", "♻️", "🪟", "🍽️", "☕", "🍳", "🛋️", "🪴", "🧻", "✨", "🫧", "🧊", "🪥", "🚪", "💧", "🌿"];

/** Primeiro emoji (grafema) do texto digitado/colado, para o campo aceitar só um. */
function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const part of new Seg(undefined, { granularity: "grapheme" }).segment(t)) return part.segment;
  return Array.from(t)[0] ?? "";
}

export function CleaningEmojiPicker({ value, onChange, disabled }: { value: string | null; onChange: (emoji: string | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const pick = (e: string | null) => { onChange(e); setOpen(false); setDraft(""); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={value ? "Trocar emoji" : "Adicionar emoji"}
          className="grid h-5 w-5 place-items-center rounded-full text-sm leading-none transition hover:bg-foreground/10"
        >
          {value ? value : <Smile className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="start">
        <div className="grid grid-cols-8 gap-1">
          {SUGGESTIONS.map((e) => (
            <button key={e} type="button" onClick={() => pick(e)} className="grid h-7 w-7 place-items-center rounded-md text-base hover:bg-muted">{e}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(firstGrapheme(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter" && draft) pick(draft); }}
            placeholder="Ou cole/digite outro"
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" className="h-8" disabled={!draft} onClick={() => pick(draft)}>OK</Button>
        </div>
        {value && <button type="button" onClick={() => pick(null)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Remover emoji</button>}
      </PopoverContent>
    </Popover>
  );
}
