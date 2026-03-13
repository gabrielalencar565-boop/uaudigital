import { useState } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import {
  useInternalDates,
  useCreateInternalDate,
  useDeleteInternalDate,
} from "@/features/agenda/hooks/use-agenda-dates";
import { getInternalDateIcon, ICON_OPTIONS, COLOR_OPTIONS } from "@/features/agenda/components/ManageInternalDatesDialog";

export function AdminDatasInternasPanel() {
  const { user } = useSession();
  const datesQ = useInternalDates();
  const createDate = useCreateInternalDate();
  const deleteDate = useDeleteInternalDate();

  const [title, setTitle] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [icon, setIcon] = useState("calendar");
  const [color, setColor] = useState("#7C5CFF");

  const handleCreate = () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Informe o título");
      return;
    }
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      toast.error("Dia inválido (1-31)");
      return;
    }
    createDate.mutate(
      { title: title.trim(), day_of_month: dayOfMonth, icon, color, created_by: user.id },
      {
        onSuccess: () => {
          toast.success("Data interna criada");
          setTitle("");
          setDayOfMonth(1);
          setIcon("calendar");
          setColor("#7C5CFF");
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteDate.mutate(id, {
      onSuccess: () => toast.success("Data removida"),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Datas internas recorrentes
          </CardTitle>
          <CardDescription>
            Datas que se repetem todo mês e aparecem no calendário da Agenda (ex.: One on One, Reunião mensal).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing dates */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Datas cadastradas</Label>
            {(datesQ.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-3">
                Nenhuma data interna cadastrada
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {(datesQ.data ?? []).map((d) => {
                const IconComp = getInternalDateIcon(d.icon);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/20 px-3 py-2.5"
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: d.color + "20" }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: d.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Todo dia {d.day_of_month}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create new */}
          <div className="border-t border-border/60 pt-4 space-y-4">
            <Label className="text-sm font-semibold">Nova data</Label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  placeholder="Ex.: One on One"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="space-y-2">
                <Label>Dia do mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIcon(opt.id)}
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center border transition-all",
                        icon === opt.id
                          ? "ring-2 ring-offset-2 ring-foreground border-foreground bg-muted"
                          : "border-border hover:bg-muted/50"
                      )}
                      title={opt.label}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all flex-shrink-0",
                      color === c ? "ring-2 ring-offset-2 ring-foreground" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Button
              variant="brand"
              onClick={handleCreate}
              disabled={!title.trim() || createDate.isPending}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Criar data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
