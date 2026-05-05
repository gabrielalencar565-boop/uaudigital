import { useState, useMemo, useCallback } from "react";
import { Plus, Trash2, SprayCan, Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTeamMembers } from "@/features/data/queries";
import {
  useCleaningCategories,
  useCreateCleaningCategory,
  useDeleteCleaningCategory,
  useCleaningSchedules,
  useCreateCleaningSchedule,
  useDeleteCleaningSchedule,
  useUpdateCleaningSchedule,
  DAYS_PT,
} from "@/features/cleaning/hooks/use-cleaning";

export function AdminLimpezaPanel() {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedDay, setSelectedDay] = useState("1"); // segunda
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTime, setSelectedTime] = useState("18:00");

  const categoriesQ = useCleaningCategories();
  const createCategory = useCreateCleaningCategory();
  const deleteCategory = useDeleteCleaningCategory();

  const schedulesQ = useCleaningSchedules();
  const createSchedule = useCreateCleaningSchedule();
  const deleteSchedule = useDeleteCleaningSchedule();
  const updateSchedule = useUpdateCleaningSchedule();

  // Editing state: schedule id -> new user_id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState("");

  const startEdit = useCallback((scheduleId: string, currentUserId: string) => {
    setEditingId(scheduleId);
    setEditUserId(currentUserId);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditUserId("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editUserId) return;
    try {
      await updateSchedule.mutateAsync({ id: editingId, user_id: editUserId });
      toast.success("Responsável atualizado!");
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar");
    }
  }, [editingId, editUserId, updateSchedule, cancelEdit]);

  const teamQ = useTeamMembers();
  const activeMembers = useMemo(
    () => (teamQ.data ?? []).filter((m) => m.is_active),
    [teamQ.data]
  );

  const teamById = useMemo(
    () => new Map(activeMembers.map((m) => [m.user_id, m])),
    [activeMembers]
  );

  const categories = categoriesQ.data ?? [];
  const schedules = schedulesQ.data ?? [];

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync(name);
      setNewCategoryName("");
      toast.success("Categoria criada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar categoria");
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedUser || !selectedCategory) {
      toast.error("Selecione membro e categoria");
      return;
    }
    try {
      await createSchedule.mutateAsync({
        day_of_week: Number(selectedDay),
        user_id: selectedUser,
        category_id: selectedCategory,
        due_time: selectedTime + ":00",
      });
      toast.success("Escala adicionada!");
    } catch (e: any) {
      if (e?.message?.includes("duplicate")) {
        toast.error("Essa escala já existe!");
      } else {
        toast.error(e?.message ?? "Erro ao adicionar escala");
      }
    }
  };

  // Group schedules by day
  const schedulesByDay = useMemo(() => {
    const map = new Map<number, typeof schedules>();
    for (const s of schedules) {
      const prev = map.get(s.day_of_week) ?? [];
      prev.push(s);
      map.set(s.day_of_week, prev);
    }
    return map;
  }, [schedules]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  return (
    <div className="space-y-6">
      {/* Categorias */}
      <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SprayCan className="h-4 w-4" />
            Categorias de Limpeza
          </CardTitle>
          <CardDescription>Crie categorias como "Passar pano", "Varrer", etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome da categoria..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              className="max-w-xs"
            />
            <Button size="sm" variant="brand" onClick={handleAddCategory} disabled={createCategory.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                {c.name}
                <button
                  onClick={() => deleteCategory.mutate(c.id)}
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </Badge>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma categoria criada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escala Semanal */}
      <Card className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <CardHeader>
          <CardTitle className="text-base">Escala Semanal</CardTitle>
          <CardDescription>Defina quem faz qual limpeza em cada dia da semana.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form para adicionar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dia</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {DAYS_PT.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Membro</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {activeMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horário limite</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-28"
              />
            </div>
            <Button size="sm" variant="brand" onClick={handleAddSchedule} disabled={createSchedule.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Lista por dia */}
          <div className="space-y-3">
            {DAYS_PT.map((dayName, dayIdx) => {
              const daySchedules = schedulesByDay.get(dayIdx) ?? [];
              if (daySchedules.length === 0) return null;
              return (
                <div key={dayIdx} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold mb-2">{dayName}</p>
                  <div className="space-y-1">
                    {daySchedules.map((s) => {
                      const member = teamById.get(s.user_id);
                      const cat = categoryById.get(s.category_id);
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Select value={editUserId} onValueChange={setEditUserId}>
                                <SelectTrigger className="w-40 h-7 text-xs">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover z-50">
                                  {activeMembers.map((m) => (
                                    <SelectItem key={m.user_id} value={m.user_id}>
                                      {m.display_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">→ {cat?.name ?? "—"}</span>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-500 hover:text-green-400" onClick={saveEdit} disabled={updateSchedule.isPending}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span>
                                <span className="font-medium">{member?.display_name ?? "—"}</span>
                                {" → "}
                                <span className="text-muted-foreground">{cat?.name ?? "—"}</span>
                                {" • "}
                                <span className="text-muted-foreground">{s.due_time?.slice(0, 5) ?? "18:00"}</span>
                              </span>
                              <div className="flex items-center gap-0.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => startEdit(s.id, s.user_id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => deleteSchedule.mutate(s.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma escala configurada.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
