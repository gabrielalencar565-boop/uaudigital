import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Code,
  List, ListOrdered, Heading1, Heading2, Heading3, Heading4, AlignLeft,
  ChevronDown, ChevronUp, FileText, Type, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const HEADING_OPTIONS = [
  { tag: "p", label: "Texto", icon: Type, shortcut: "" },
  { tag: "h1", label: "Cabeçalho 1", icon: Heading1, shortcut: "" },
  { tag: "h2", label: "Cabeçalho 2", icon: Heading2, shortcut: "" },
  { tag: "h3", label: "Cabeçalho 3", icon: Heading3, shortcut: "" },
  { tag: "h4", label: "Cabeçalho 4", icon: Heading4, shortcut: "" },
];

const TOOLBAR_ITEMS = [
  { cmd: "insertUnorderedList", icon: List, label: "Lista" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Lista numerada" },
  { divider: true },
  { cmd: "heading_dropdown", icon: Heading2, label: "Cabeçalho" },
  { divider: true },
  { cmd: "bold", icon: Bold, label: "Negrito" },
  { cmd: "italic", icon: Italic, label: "Itálico" },
  { cmd: "underline", icon: Underline, label: "Sublinhado" },
  { cmd: "strikeThrough", icon: Strikethrough, label: "Tachado" },
  { cmd: "code", icon: Code, label: "Código" },
] as const;

export function RichDescriptionEditor({ value, onChange, onSave, onCancel }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, []);

  const [headingOpen, setHeadingOpen] = useState(false);
  const [currentBlock, setCurrentBlock] = useState("p");

  const updateCurrentBlock = useCallback(() => {
    const val = document.queryCommandValue("formatBlock");
    setCurrentBlock(val || "p");
  }, []);

  const execCmd = useCallback((cmd: string) => {
    if (cmd.startsWith("formatBlock_")) {
      const tag = cmd.replace("formatBlock_", "");
      const current = document.queryCommandValue("formatBlock");
      if (current === tag) {
        document.execCommand("formatBlock", false, "p");
        setCurrentBlock("p");
      } else {
        document.execCommand("formatBlock", false, tag);
        setCurrentBlock(tag);
      }
    } else if (cmd === "code") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const text = range.toString();
        if (text) {
          const code = document.createElement("code");
          code.className = "bg-muted px-1 py-0.5 rounded text-xs font-mono";
          code.textContent = text;
          range.deleteContents();
          range.insertNode(code);
        }
      }
    } else {
      document.execCommand(cmd, false);
    }
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-card p-1 flex-wrap">
        {TOOLBAR_ITEMS.map((item, i) => {
          if ("divider" in item) {
            return <div key={`d-${i}`} className="mx-0.5 h-5 w-px bg-border/40" />;
          }

          // Heading dropdown
          if (item.cmd === "heading_dropdown") {
            const currentHeading = HEADING_OPTIONS.find(h => h.tag === currentBlock) ?? HEADING_OPTIONS[0];
            const CurrentIcon = currentHeading.icon;
            return (
              <Popover key="heading" open={headingOpen} onOpenChange={setHeadingOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    title="Transformar em"
                  >
                    <CurrentIcon className="h-3.5 w-3.5" />
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1" sideOffset={6}>
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground font-medium">Transformar em</p>
                  {HEADING_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const isActive = currentBlock === opt.tag;
                    return (
                      <button
                        key={opt.tag}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          execCmd(`formatBlock_${opt.tag}`);
                          setHeadingOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                          isActive && "text-primary"
                        )}
                      >
                        <OptIcon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left font-medium">{opt.label}</span>
                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            );
          }

          const Ico = item.icon;
          return (
            <button
              key={item.cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd(item.cmd); }}
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                item.cmd === "bold" && "font-bold"
              )}
              title={item.label}
            >
              <Ico className="h-3.5 w-3.5" />
            </button>
          );
        })}

        {/* Alignment dropdown */}
        <div className="mx-0.5 h-5 w-px bg-border/40" />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd("justifyLeft"); }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title="Alinhar"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className={cn(
          "min-h-[120px] max-h-[300px] overflow-y-auto rounded-lg border border-border/60 bg-background px-3 py-2",
          "text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-0.5",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
        )}
        suppressContentEditableWarning
      />

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); onSave(); }}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/**
 * Read-only expandable description with HTML support
 */
export function ExpandableDescription({
  html,
  onEdit,
}: {
  html: string | null | undefined;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsExpand(contentRef.current.scrollHeight > 80);
    }
  }, [html]);

  if (!html) {
    return (
      <div
        className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition min-h-[40px] py-2 flex items-center gap-2"
        onClick={onEdit}
      >
        <FileText className="h-4 w-4" />
        Adicione uma descrição...
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <button
          onClick={onEdit}
          className="text-xs text-muted-foreground hover:text-foreground transition"
          title="Editar descrição"
        >
          <Type className="h-3.5 w-3.5 inline mr-1" />
          Editar
        </button>
        {needsExpand && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition"
          >
            {expanded ? (
              <>Recolher <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>Expandir <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}
      </div>
      <div
        ref={contentRef}
        onClick={onEdit}
        className={cn(
          "cursor-pointer text-sm text-foreground/80 hover:text-foreground transition overflow-hidden",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-0.5",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
          !expanded && "max-h-[80px]"
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {!expanded && needsExpand && (
        <div className="h-6 -mt-6 bg-gradient-to-t from-background to-transparent pointer-events-none relative z-10" />
      )}
    </div>
  );
}
