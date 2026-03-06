import { Film, Image, LayoutGrid, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";

const POST_TYPES = [
  { key: "reels", label: "Reels", icon: Film },
  { key: "carrossel", label: "Carrossel", icon: LayoutGrid },
  { key: "post", label: "Post", icon: Image },
  { key: "foto", label: "Foto", icon: Camera },
];

interface Props {
  task: PmTask;
}

export function PmPostingFields({ task }: Props) {
  const updateTask = useUpdatePmTask();

  const handleUpdate = (field: string, value: string | null) => {
    updateTask.mutate({ id: task.id, [field]: value || null } as any);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/30 bg-card/30 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">📅 Dados de Postagem</h4>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Tipo de Post</Label>
          <Select value={task.post_type ?? ""} onValueChange={(v) => handleUpdate("post_type", v)}>
            <SelectTrigger className="h-8 text-xs rounded-lg">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {POST_TYPES.map(pt => {
                const Icon = pt.icon;
                return (
                  <SelectItem key={pt.key} value={pt.key}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {pt.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Data de Postagem</Label>
          <Input
            type="date"
            value={task.posting_date ?? ""}
            onChange={(e) => handleUpdate("posting_date", e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Horário</Label>
          <Input
            type="time"
            value={task.posting_time ?? ""}
            onChange={(e) => handleUpdate("posting_time", e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Legenda</Label>
        <Textarea
          value={task.caption ?? ""}
          onChange={(e) => handleUpdate("caption", e.target.value)}
          placeholder="Escreva a legenda do post..."
          className="text-xs min-h-[80px] rounded-lg resize-none"
        />
      </div>
    </div>
  );
}
