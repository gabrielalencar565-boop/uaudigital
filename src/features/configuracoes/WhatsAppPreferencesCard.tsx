import { useEffect, useState } from "react";
import { MessageCircle, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

type Prefs = {
  phone_e164: string;
  enabled: boolean;
  notify_new_task: boolean;
  notify_deadline: boolean;
  notify_company: boolean;
  notify_xp_rank: boolean;
};

const DEFAULT_PREFS: Prefs = {
  phone_e164: "",
  enabled: true,
  notify_new_task: true,
  notify_deadline: true,
  notify_company: true,
  notify_xp_rank: true,
};

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

export function WhatsAppPreferencesCard() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_whatsapp_preferences" as any)
      .select("phone_e164, enabled, notify_new_task, notify_deadline, notify_company, notify_xp_rank")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setPrefs({ ...DEFAULT_PREFS, ...(data as any) });
        setLoading(false);
      }, () => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const phone = digitsOnly(prefs.phone_e164);
    if (phone && phone.length < 10) {
      toast.error("Número inválido. Inclua DDD + número.");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("user_whatsapp_preferences" as any)
      .upsert(
        { user_id: user.id, ...prefs, phone_e164: phone || null },
        { onConflict: "user_id" },
      );
    if (error) toast.error(error.message);
    else toast.success("Preferências de WhatsApp salvas");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Notificações WhatsApp
        </CardTitle>
        <CardDescription>
          Receba avisos automáticos da plataforma direto no seu WhatsApp.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="wa-phone">Número de WhatsApp</Label>
          <Input
            id="wa-phone"
            inputMode="tel"
            placeholder="(11) 99999-8888"
            value={prefs.phone_e164}
            onChange={(e) => setPrefs((p) => ({ ...p, phone_e164: e.target.value }))}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Inclua DDD. O código do país (Brasil = 55) é adicionado automaticamente quando necessário.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <div className="font-medium">Ativar notificações</div>
            <p className="text-xs text-muted-foreground">Desligue para pausar todos os envios para você.</p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))}
            disabled={loading}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Quais avisos eu quero receber</div>
          {([
            ["notify_new_task", "Novas tarefas atribuídas", "Quando uma nova tarefa for atribuída a você."],
            ["notify_deadline", "Lembretes de prazo", "Tarefas próximas do vencimento ou atrasadas."],
            ["notify_company", "Avisos da empresa", "Comunicados gerais enviados por administradores."],
            ["notify_xp_rank", "Ranking XP semanal", "Sua posição no ranking semanal de performance."],
          ] as const).map(([key, title, desc]) => (
            <div key={key} className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <div className="font-medium">{title}</div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                disabled={loading || !prefs.enabled}
              />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={save} variant="brand" className="gap-2" disabled={saving || loading}>
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar preferências"}
        </Button>
      </CardFooter>
    </Card>
  );
}
