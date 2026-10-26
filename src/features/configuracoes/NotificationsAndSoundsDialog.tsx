import { useState } from "react";
import { Bell, BellRing, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { NotificationSoundsPanel } from "./NotificationSoundsDialog";
import { PushNotificationsPanel } from "./PushNotificationsDialog";

// A animação de abertura roda antes do login, então a escolha fica neste aparelho (localStorage) e é lida direto pelo index.html.
const INTRO_KEY = "fluxo-loader-intro";
const INTRO_SOUND_KEY = "fluxo-loader-sound";
const readPref = (key: string) => { try { return localStorage.getItem(key) !== "off"; } catch { return true; } };
const writePref = (key: string, on: boolean) => { try { localStorage.setItem(key, on ? "on" : "off"); } catch { /* sem armazenamento: vale só até recarregar */ } };

function IntroPanel() {
  const [introOn, setIntroOn] = useState(() => readPref(INTRO_KEY));
  const [soundOn, setSoundOn] = useState(() => readPref(INTRO_SOUND_KEY));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Animação inicial</div>
          <div className="text-xs text-muted-foreground">A tela com o logo que aparece quando o Fluxo abre. Vale só neste aparelho.</div>
        </div>
        <Switch
          checked={introOn}
          onCheckedChange={(v) => {
            setIntroOn(v);
            writePref(INTRO_KEY, v);
            toast.success(v ? "A animação inicial volta a aparecer." : "A animação inicial não aparece mais neste aparelho.");
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Som da animação</div>
          <div className="text-xs text-muted-foreground">O efeito sonoro que toca junto com o logo. Dá para desligar o som e manter a animação.</div>
        </div>
        <Switch
          checked={soundOn}
          onCheckedChange={(v) => {
            setSoundOn(v);
            writePref(INTRO_SOUND_KEY, v);
            toast.success(v ? "O som da animação foi ligado." : "O som da animação foi desligado.");
          }}
        />
      </div>
    </div>
  );
}

/** Um lugar só para os sons e avisos: sons das notificações, notificações push e animação inicial (com o som dela). */
export function NotificationsAndSoundsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sons e notificações
          </DialogTitle>
          <DialogDescription>Escolha como o Fluxo avisa você: sons, avisos no aparelho e a animação de abertura.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="sons" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sons" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" />Sons</TabsTrigger>
            <TabsTrigger value="push" className="gap-1.5 text-xs"><BellRing className="h-3.5 w-3.5" />Push</TabsTrigger>
            <TabsTrigger value="abertura" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" />Abertura</TabsTrigger>
          </TabsList>
          <TabsContent value="sons" className="mt-3"><NotificationSoundsPanel /></TabsContent>
          <TabsContent value="push" className="mt-3"><PushNotificationsPanel /></TabsContent>
          <TabsContent value="abertura" className="mt-3"><IntroPanel /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
