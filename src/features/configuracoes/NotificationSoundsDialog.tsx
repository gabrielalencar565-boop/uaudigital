import { useState } from "react";
import { Play, VolumeX, Bell, Volume2, Volume1 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  NOTIFICATION_SOUNDS,
  getCategorySound,
  setCategorySound,
  getNotificationVolume,
  setNotificationVolume,
  type SoundCategory,
} from "@/lib/notifications";

function SoundRow({
  category,
  title,
  description,
}: {
  category: SoundCategory;
  title: string;
  description: string;
}) {
  const [value, setValue] = useState<string>(() => getCategorySound(category));

  const handleChange = (next: string) => {
    setValue(next);
    setCategorySound(category, next);
    if (next !== "off") {
      NOTIFICATION_SOUNDS.find((x) => x.id === next)?.play();
    }
    toast.success("Preferência salva");
  };

  const handlePreview = () => {
    if (value === "off") return;
    NOTIFICATION_SOUNDS.find((x) => x.id === value)?.play();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Som" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">
              <span className="flex items-center gap-2">
                <VolumeX className="h-3.5 w-3.5" /> Desligado
              </span>
            </SelectItem>
            {NOTIFICATION_SOUNDS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={value === "off"}
          onClick={handlePreview}
          title="Tocar"
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationSoundsPanel() {
  return (
    <div className="space-y-3">
      <SoundRow
        category="chat"
        title="Mensagens do chat"
        description="Tocado quando você recebe uma mensagem privada ou no chat geral."
      />
      <SoundRow
        category="task"
        title="Tarefas e menções"
        description="Atribuição, prazos vencendo, tarefas atrasadas e menções em comentários."
      />
    </div>
  );
}

export function NotificationSoundsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sons de notificação
          </DialogTitle>
          <DialogDescription>
            Escolha um som diferente para cada tipo ou desligue por categoria.
          </DialogDescription>
        </DialogHeader>
        <NotificationSoundsPanel />
      </DialogContent>
    </Dialog>
  );
}
