import { useEffect, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RECENTS_KEY = "uau_color_picker_recents";
const MAX_RECENTS = 8;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(hex: string) {
  try {
    const next = [hex, ...loadRecents().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc.) — recent colors just won't persist.
  }
}

export function ColorPickerPopover({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecents(loadRecents());
    else if (/^#[0-9a-fA-F]{6}$/.test(value)) pushRecent(value);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Escolher cor"
          className="h-10 w-10 shrink-0 rounded-full border border-border shadow-sm transition hover:scale-105"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[248px] space-y-3 p-4 [&_.react-colorful]:h-40 [&_.react-colorful]:w-full [&_.react-colorful]:gap-3 [&_.react-colorful__hue]:mt-1 [&_.react-colorful__hue]:h-3 [&_.react-colorful__hue]:rounded-full [&_.react-colorful__hue-pointer]:h-5 [&_.react-colorful__hue-pointer]:w-5 [&_.react-colorful__saturation]:rounded-xl [&_.react-colorful__saturation-pointer]:h-5 [&_.react-colorful__saturation-pointer]:w-5"
      >
        <HexColorPicker color={value} onChange={onChange} />

        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <span className="text-sm text-muted-foreground">#</span>
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed={false}
            className="w-full bg-transparent text-sm font-mono uppercase outline-none"
          />
        </div>

        {recents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cores recentes</p>
            <div className="flex flex-wrap gap-1.5">
              {recents.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  title={c}
                  className="h-6 w-6 rounded-md border border-border/60 transition hover:scale-110"
                  style={{ backgroundColor: c }}
                  onClick={() => onChange(c)}
                />
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
