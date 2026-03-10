import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Wand2, Loader2, SpellCheck, ArrowUpRight, ArrowDownRight, Feather, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AI_ACTIONS = [
  { key: "improve", label: "Melhorar a escrita", icon: Sparkles },
  { key: "grammar", label: "Corrigir ortografia e gramática", icon: SpellCheck },
  { key: "longer", label: "Tornar mais longo", icon: ArrowUpRight },
  { key: "shorter", label: "Tornar mais curto", icon: ArrowDownRight },
  { key: "simplify", label: "Simplificar a escrita", icon: Feather },
];

const TOOLBAR_BUTTONS = [
  { cmd: "bold", icon: Bold, label: "Negrito" },
  { cmd: "italic", icon: Italic, label: "Itálico" },
  { cmd: "underline", icon: Underline, label: "Sublinhado" },
  { cmd: "strikeThrough", icon: Strikethrough, label: "Tachado" },
  { divider: true },
  { cmd: "insertUnorderedList", icon: List, label: "Lista" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Lista numerada" },
] as const;

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function SmartCaptionEditor({ value, onChange, placeholder = "Escreva aqui...", className, minHeight = "80px" }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Init content
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML && value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  // Debounced auto-save
  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 600);
  }, [onChange]);

  // Show floating toolbar on selection
  const updateToolbarPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setToolbarPos(null);
      setAiMenuOpen(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    setToolbarPos({
      top: rect.top - editorRect.top - 44,
      left: Math.max(0, rect.left - editorRect.left + rect.width / 2 - 120),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbarPosition);
    return () => document.removeEventListener("selectionchange", updateToolbarPosition);
  }, [updateToolbarPosition]);

  const execCmd = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  // AI improve
  const handleAiAction = useCallback(async (action: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    setAiLoading(true);
    setAiMenuOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("ai-improve-text", {
        body: { text: selectedText, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      if (result) {
        // Replace selected text
        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(result));
          // Trigger save
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
        toast.success("Texto melhorado com IA!");
      }
    } catch (e: any) {
      console.error("AI improve error:", e);
      toast.error(e?.message || "Erro ao melhorar texto");
    } finally {
      setAiLoading(false);
      setToolbarPos(null);
    }
  }, [onChange]);

  const showPlaceholder = !value || value === "<br>" || value === "<div><br></div>";

  return (
    <div className={cn("relative", className)}>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={() => {
          // Final save on blur
          if (debounceRef.current) clearTimeout(debounceRef.current);
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        data-placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-border/40 bg-background px-3 py-2",
          "text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none",
          showPlaceholder && !editorRef.current?.innerHTML && "before:content-[attr(data-placeholder)] before:text-muted-foreground/50",
        )}
        style={{ minHeight }}
        suppressContentEditableWarning
      />

      {/* Floating toolbar */}
      {toolbarPos && !aiLoading && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-0.5 rounded-xl border border-white/10 shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: toolbarPos.top, left: toolbarPos.left, background: "linear-gradient(135deg, hsl(270 60% 28%), hsl(290 50% 22%))" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {TOOLBAR_BUTTONS.map((item, i) => {
            if ("divider" in item) {
              return <div key={`d-${i}`} className="mx-0.5 h-5 w-px bg-border/40" />;
            }
            const Ico = item.icon;
            return (
              <button
                key={item.cmd}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execCmd(item.cmd); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title={item.label}
              >
                <Ico className="h-3.5 w-3.5" />
              </button>
            );
          })}

          <div className="mx-0.5 h-5 w-px bg-border/40" />

          {/* AI button */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setAiMenuOpen(v => !v); }}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                aiMenuOpen && "bg-accent text-accent-foreground"
              )}
              title="Melhorar com IA"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">IA</span>
            </button>

            {aiMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-lg border border-border/60 bg-popover shadow-xl p-1 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150">
                <p className="px-2 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Melhorar com IA
                </p>
                {AI_ACTIONS.map((a) => {
                  const Ico = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAiAction(a.key); }}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Ico className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left font-medium">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI loading overlay */}
      {aiLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg backdrop-blur-sm z-50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Melhorando texto...</span>
          </div>
        </div>
      )}
    </div>
  );
}
