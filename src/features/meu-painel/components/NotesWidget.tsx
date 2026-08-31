import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, StickyNote, Trash2 } from "lucide-react";

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
  useSetNoteTime,
  type PersonalNote,
} from "@/features/meu-painel/hooks/use-personal-notes";

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
  const setTime = useSetNoteTime();

  const today = useMemo(() => todayIsoWeekday(), []);
  const [selectedDay, setSelectedDay] = useState(today);

  const handleNewNote = (dayOfWeek?: number | null) => {
    if (!user?.id) return;
    createNote.mutate({ userId: user.id, dayOfWeek });
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
      </CardHeader>
      <CardContent className="p-0">
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
                  onSaveTitle={(title) => updateNote.mutate({ id: n.id, title, content: title })}
                  onDelete={() => deleteNote.mutate(n.id)}
                  onToggleDone={() => toggleDone.mutate({ id: n.id, done: !n.done })}
                  onSetTime={(time) => setTime.mutate({ id: n.id, time })}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function NoteRow({
  note,
  onSaveTitle,
  onDelete,
  onToggleDone,
  onSetTime,
}: {
  note: PersonalNote;
  onSaveTitle: (title: string) => void;
  onDelete: () => void;
  onToggleDone: () => void;
  onSetTime: (time: string | null) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [editingTime, setEditingTime] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(note.title);
  }, [note.title]);

  // A brand-new note has an empty title — focus it immediately so typing the name is the
  // very next thing that happens, no extra click needed.
  useEffect(() => {
    if (note.title === "" && inputRef.current) inputRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitTitle = () => {
    if (title !== note.title) onSaveTitle(title);
  };

  return (
    <div className="group relative flex items-center gap-2 px-4 py-2">
      <button
        type="button"
        onClick={onToggleDone}
        title={note.done ? "Marcar como não concluída" : "Marcar como concluída"}
        className={cn("shrink-0 transition", note.done ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-500")}
      >
        {note.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </button>

      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="Nome da demanda…"
        className={cn(
          "min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60",
          note.done ? "text-muted-foreground line-through" : "text-foreground",
        )}
      />

      {editingTime ? (
        <input
          type="time"
          autoFocus
          defaultValue={note.time_of_day?.slice(0, 5) ?? ""}
          onBlur={(e) => {
            onSetTime(e.target.value || null);
            setEditingTime(false);
          }}
          className="w-[84px] shrink-0 rounded border border-border/60 bg-transparent px-1 py-0.5 text-[11px] text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingTime(true)}
          title="Definir horário"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition",
            note.time_of_day ? "text-amber-600" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-600",
          )}
        >
          <Clock className="h-3 w-3" />
          {note.time_of_day && note.time_of_day.slice(0, 5)}
        </button>
      )}

      <button
        type="button"
        title="Excluir"
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
