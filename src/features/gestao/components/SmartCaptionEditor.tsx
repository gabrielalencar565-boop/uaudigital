import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Wand2, Loader2, SpellCheck, ArrowUpRight, ArrowDownRight, Feather, Sparkles,
  Undo2, Redo2, Type, Heading1, Heading2, Heading3, Heading4, ChevronDown, Check,
  Clock, Maximize2, CheckCircle2,
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

const HEADING_OPTIONS = [
  { tag: "p", label: "Texto", icon: Type },
  { tag: "h1", label: "Cabeçalho 1", icon: Heading1 },
  { tag: "h2", label: "Cabeçalho 2", icon: Heading2 },
  { tag: "h3", label: "Cabeçalho 3", icon: Heading3 },
  { tag: "h4", label: "Cabeçalho 4", icon: Heading4 },
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

const GRADIENT_TOOLBAR = "linear-gradient(135deg, hsl(263 70% 50%), hsl(263 70% 36%))";
const GRADIENT_MENU = "linear-gradient(160deg, hsl(263 70% 42%), hsl(263 70% 30%))";

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
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [currentBlock, setCurrentBlock] = useState("p");
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
      setHeadingMenuOpen(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    const val = document.queryCommandValue("formatBlock");
    setCurrentBlock(val || "p");
    setToolbarPos({
      top: rect.top - editorRect.top - 48,
      left: Math.max(0, Math.min(rect.left - editorRect.left + rect.width / 2 - 160, editorRect.width - 340)),
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

  const applyHeading = useCallback((tag: string) => {
    const current = document.queryCommandValue("formatBlock");
    if (current === tag) {
      document.execCommand("formatBlock", false, "p");
      setCurrentBlock("p");
    } else {
      document.execCommand("formatBlock", false, tag);
      setCurrentBlock(tag);
    }
    editorRef.current?.focus();
    handleInput();
    setHeadingMenuOpen(false);
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
        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(result));
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
  const currentHeading = HEADING_OPTIONS.find(h => h.tag === currentBlock) ?? HEADING_OPTIONS[0];
  const CurrentHeadingIcon = currentHeading.icon;

  return (
    <div className={cn("relative", className)}>
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        data-placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-border/40 bg-background px-3 py-2",
          "text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-0.5",
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
          className="absolute z-50 flex items-center gap-0.5 rounded-xl border border-white/15 shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: toolbarPos.top, left: toolbarPos.left, background: GRADIENT_TOOLBAR }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Undo / Redo */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCmd("undo"); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCmd("redo"); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* Heading dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setHeadingMenuOpen(v => !v); setAiMenuOpen(false); }}
              className={cn(
                "inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white",
                headingMenuOpen && "bg-white/20 text-white"
              )}
              title="Transformar em"
            >
              <CurrentHeadingIcon className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {headingMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150"
                style={{ background: GRADIENT_MENU }}
              >
                <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">Transformar em</p>
                {HEADING_OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const isActive = currentBlock === opt.tag;
                  return (
                    <button
                      key={opt.tag}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyHeading(opt.tag); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10",
                        isActive && "bg-white/15"
                      )}
                    >
                      <OptIcon className="h-4 w-4 shrink-0 text-white/60" />
                      <span className="flex-1 text-left font-medium text-white/90">{opt.label}</span>
                      {isActive && <Check className="h-4 w-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* Format buttons */}
          {TOOLBAR_BUTTONS.map((item, i) => {
            if ("divider" in item) {
              return <div key={`d-${i}`} className="mx-0.5 h-5 w-px bg-white/15" />;
            }
            const Ico = item.icon;
            return (
              <button
                key={item.cmd}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execCmd(item.cmd); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                title={item.label}
              >
                <Ico className="h-3.5 w-3.5" />
              </button>
            );
          })}

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* AI button */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setAiMenuOpen(v => !v); setHeadingMenuOpen(false); }}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white",
                aiMenuOpen && "bg-white/20 text-white"
              )}
              title="Melhorar com IA"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">IA</span>
            </button>

            {aiMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150"
                style={{ background: GRADIENT_MENU }}
              >
                <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">
                  Melhorar com IA
                </p>
                {AI_ACTIONS.map((a) => {
                  const Ico = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAiAction(a.key); }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
                    >
                      <Ico className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="flex-1 text-left font-medium text-white/90">{a.label}</span>
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
