import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, Plus, Search, StickyNote, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useMyNotes, useCreateNote, useUpdateNote, useDeleteNote, type PersonalNote } from "@/features/meu-painel/hooks/use-personal-notes";

// Every field the Notes app derives from raw text, mirrored here: the "title" is just the
// note's own first line (there's no separate title column in the real app either), and
// the list preview is the next non-empty line, exactly like iOS.
function deriveTitle(content: string): string {
  const firstLine = content.split("\n")[0]?.trim();
  return firstLine || "Nova nota";
}
function derivePreview(content: string): string {
  const lines = content.split("\n").slice(1);
  const line = lines.find((l) => l.trim().length > 0);
  return line?.trim() ?? "";
}
function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "'Hoje às' HH:mm");
  if (isYesterday(d)) return format(d, "'Ontem às' HH:mm");
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

const AUTOSAVE_DEBOUNCE_MS = 600;

export function NotesWidget() {
  const { user } = useSession();
  const notesQ = useMyNotes(user?.id);
  const notes = notesQ.data ?? [];
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openNote = notes.find((n) => n.id === openId) ?? null;

  useEffect(() => {
    if (openNote) setDraft(openNote.content);
    // Only re-sync the draft when switching which note is open, not on every refetch —
    // otherwise a background invalidation would clobber whatever the user is mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const scheduleSave = (content: string) => {
    if (!openId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNote.mutate({ id: openId, title: deriveTitle(content), content });
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const handleNewNote = () => {
    if (!user?.id) return;
    createNote.mutate(
      { userId: user.id },
      { onSuccess: (note) => setOpenId(note.id) },
    );
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate(id);
    if (openId === id) setOpenId(null);
  };

  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    const q = query.toLowerCase();
    return notes.filter((n) => n.content.toLowerCase().includes(q));
  }, [notes, query]);

  return (
    <Card>
      <CardHeader className="pb-2">
        {openNote ? (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="flex items-center gap-0.5 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <ChevronLeft className="h-4 w-4" />
              Notas
            </button>
            <button
              type="button"
              onClick={() => handleDelete(openNote.id)}
              title="Excluir nota"
              className="text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <StickyNote className="h-4 w-4 text-amber-500" />
              Notas
            </CardTitle>
            <button
              type="button"
              onClick={handleNewNote}
              title="Nova nota"
              className="flex h-6 w-6 items-center justify-center rounded-full text-amber-600 transition hover:bg-amber-500/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {openNote ? (
          <div className="flex flex-col px-4 pb-4">
            <p className="mb-2 text-[11px] text-muted-foreground">{formatNoteDate(openNote.updated_at)}</p>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                scheduleSave(e.target.value);
              }}
              placeholder="Comece a escrever…"
              rows={8}
              className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        ) : (
          <>
            {notes.length > 0 && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar nas notas"
                  className="w-full border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}
            <ScrollArea className="max-h-[280px]">
              {filteredNotes.length === 0 ? (
                <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
                  {notes.length === 0 ? "Nenhuma nota ainda — toque em + pra criar a primeira." : "Nada encontrado."}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredNotes.map((n) => (
                    <NoteRow key={n.id} note={n} onOpen={() => setOpenId(n.id)} onDelete={() => handleDelete(n.id)} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NoteRow({ note, onOpen, onDelete }: { note: PersonalNote; onOpen: () => void; onDelete: () => void }) {
  const title = deriveTitle(note.content);
  const preview = derivePreview(note.content);
  return (
    <div className="group relative flex items-start gap-2 px-4 py-2.5 transition hover:bg-accent/30">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {formatNoteDate(note.updated_at)}
          {preview && <span className="text-muted-foreground/70"> — {preview}</span>}
        </p>
      </button>
      <button
        type="button"
        title="Excluir"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={cn(
          "shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100",
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
