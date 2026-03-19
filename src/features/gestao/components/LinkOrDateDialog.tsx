import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Link2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface ExistingTask {
  id: string;
  due_date: string;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  existingTask: ExistingTask | null;
  onLink: (dueDate: string) => void;
  onSelectDate: (dueDate: string) => void;
}

export function LinkOrDateDialog({ open, onClose, existingTask, onLink, onSelectDate }: Props) {
  const [dateMode, setDateMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (!open) return;
    setDateMode(false);
    setSelectedDate(existingTask?.due_date ?? format(new Date(), "yyyy-MM-dd"));
  }, [open, existingTask?.due_date]);

  const handleLink = () => {
    if (existingTask?.due_date) {
      onLink(existingTask.due_date);
      onClose();
    }
  };

  const handleSelectDate = () => {
    if (dateMode) {
      onSelectDate(selectedDate);
      onClose();
    } else {
      setDateMode(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setDateMode(false); } }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle className="text-base font-bold">Tarefa existente encontrada</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Já existe uma tarefa do mesmo cliente nesta etapa na agenda
          {existingTask?.due_date ? ` (${format(new Date(existingTask.due_date + "T12:00:00"), "dd/MM/yyyy")})` : ""}.
        </p>
        {existingTask?.title && (
          <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Tarefa encontrada</p>
            <p className="text-sm font-semibold leading-tight">{existingTask.title}</p>
          </div>
        )}

        {!dateMode ? (
          <div className="space-y-2 mt-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-xl border-primary/30 hover:bg-primary/5"
              onClick={handleLink}
            >
              <Link2 className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Vincular tarefa</p>
                <p className="text-xs text-muted-foreground">Usar a data da tarefa existente</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 rounded-xl"
              onClick={handleSelectDate}
            >
              <CalendarDays className="h-4 w-4" />
              <div className="text-left">
                <p className="text-sm font-medium">Selecionar data</p>
                <p className="text-xs text-muted-foreground">Escolher uma data manualmente</p>
              </div>
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-3">
            <DatePicker value={selectedDate} onChange={(v) => setSelectedDate(v ?? selectedDate)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-xl" onClick={() => setDateMode(false)}>Voltar</Button>
              <Button className="rounded-xl" onClick={handleSelectDate}>Confirmar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
