import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronLeft, Circle, Plus, StickyNote, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import {
  useMyNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useMoveNoteToDay,
  useToggleNoteDone,
  type PersonalNote,
} from "@/features/meu-painel/hooks/use-personal-notes";

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

// ISO weekday numbering (1=segunda .. 7=domingo), Monday-first to match how the agency's
// own week already runs everywhere else in the app (Cronograma cycles, Agenda).
const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 1, label: "Seg" },
  { day: 2, label: "Ter" },
  { day: 3, label: "Qua" },
  { day: 4, label: "Qui" },
  { day: 5, label: "Sex" },
  { day: 6, label: "Sáb" },
  { day: 7, label: "Dom" },
];
function todayIsoWeekday(): number {
  const jsDay = new Date().getDay(); // 0=domingo..6=sábado
  return jsDay === 0 ? 7 : jsDay;
}

export function NotesWidget() {
  const { user } = useSession();
  const notesQ = useMyNotes(user?.id);
  const notes = notesQ.data ?? [];
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const moveNote = useMoveNoteToDay();
  const toggleDone = useToggleNoteDone();

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = useMemo(() => todayIsoWeekday(), []);
  const [selectedDay, setSelectedDay] = useState(today);

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

  const handleNewNote = (dayOfWeek?: number | null) => {
    if (!user?.id) return;
    createNote.mutate(
      { userId: user.id, dayOfWeek },
      { onSuccess: (note) => setOpenId(note.id) },
    );
  };

  const handleDelete = (id: string) => {
    deleteNote.mutate(id);
    if (openId === id) setOpenId(null);
  };

  const notesByDay = useMemo(() => {
    const map = new Map<number, PersonalNote[]>();
    for (const n of notes) {
      if (!n.day_of_week) continue;
      const list = map.get(n.day_of_week) ?? [];
      list.push(n);
      map.set(n.day_of_week, list);
    }
    // Checked-off notes sink to the bottom of their day, same as a to-do list — everything
    // still to do stays up top where it's visible at a glance.
    for (const list of map.values()) list.sort((a, b) => Number(a.done) - Number(b.done));
    return map;
  }, [notes]);

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
              onClick={() => handleNewNote(selectedDay)}
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">{formatNoteDate(openNote.updated_at)}</p>
              <div className="flex items-center gap-1">
                {WEEK_DAYS.map(({ day, label }) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => moveNote.mutate({ id: openNote.id, dayOfWeek: openNote.day_of_week === day ? null : day })}
                    title={`Colocar na ${label}`}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold transition",
                      openNote.day_of_week === day
                        ? "bg-amber-500 text-white"
                        : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {label[0]}
                  </button>
                ))}
              </div>
            </div>
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
            <div className="mx-4 mb-2 flex items-center justify-between gap-1">
              {WEEK_DAYS.map(({ day, label }) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  title={label}
                  className={cn(
                    "flex h-7 w-7 flex-col items-center justify-center rounded-full text-[10px] font-semibold transition",
                    selectedDay === day
                      ? "bg-amber-500 text-white"
                      : day === today
                        ? "text-amber-600 ring-1 ring-amber-400/50"
                        : "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                  )}
                >
                  {label[0]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNewNote(selectedDay)}
                title="Nova nota nesse dia"
                className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-600 transition hover:bg-amber-500/10"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ScrollArea className="max-h-[280px]">
              {(notesByDay.get(selectedDay) ?? []).length === 0 ? (
                <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
                  Nenhuma nota em {WEEK_DAYS.find((d) => d.day === selectedDay)?.label} — toque em + pra criar.
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {(notesByDay.get(selectedDay) ?? []).map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      onOpen={() => setOpenId(n.id)}
                      onDelete={() => handleDelete(n.id)}
                      onToggleDone={() => toggleDone.mutate({ id: n.id, done: !n.done })}
                    />
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

function NoteRow({
  note,
  onOpen,
  onDelete,
  onToggleDone,
}: {
  note: PersonalNote;
  onOpen: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}) {
  const title = deriveTitle(note.content);
  const preview = derivePreview(note.content);
  return (
    <div className="group relative flex items-start gap-2 px-4 py-2.5 transition hover:bg-accent/30">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone();
        }}
        title={note.done ? "Marcar como não concluída" : "Marcar como concluída"}
        className={cn("mt-0.5 shrink-0 transition", note.done ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-500")}
      >
        {note.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={cn("truncate text-[13px] font-medium", note.done ? "text-muted-foreground line-through" : "text-foreground")}>
          {title}
        </p>
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
