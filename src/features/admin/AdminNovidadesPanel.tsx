import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import type { MainTab } from "@/components/layout/UauSidebarShell";
import { toast } from "sonner";

// Destinos pra onde o clique no aviso pode levar — mesmas abas do menu lateral, com rótulos
// amigáveis pra quem tá escrevendo o aviso (não precisa saber a chave interna da aba).
const TARGET_TABS: { value: MainTab; label: string }[] = [
  { value: "meu_painel", label: "Meu Painel" },
  { value: "agenda_gestao", label: "Agenda" },
  { value: "pauta_pessoas", label: "Pauta" },
  { value: "calendario_publicacao", label: "Cronograma" },
  { value: "visao_do_dia", label: "Visão do Dia" },
  { value: "magic2", label: "Magic Number" },
  { value: "desempenho", label: "The Best" },
  { value: "visao_geral_projetos", label: "Painel de Squads" },
  { value: "financeiro", label: "Financeiro" },
  { value: "metas", label: "Metas" },
  { value: "recompensas", label: "Uau XP" },
  { value: "comercial", label: "Comercial" },
  { value: "configuracoes", label: "Configurações" },
];

export function AdminNovidadesPanel() {
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetTab, setTargetTab] = useState<string>("__none__");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appSettingsQ.data) return;
    setTitle(appSettingsQ.data.whats_new_title ?? "");
    setDescription(appSettingsQ.data.whats_new_description ?? "");
    setTargetTab(appSettingsQ.data.whats_new_target_tab ?? "__none__");
    setEnabled(appSettingsQ.data.whats_new_enabled);
  }, [appSettingsQ.data]);

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error("Escreva um título pro aviso");
      return;
    }
    setSaving(true);
    try {
      await updateAppSettings.mutateAsync({
        whats_new_enabled: true,
        whats_new_title: title.trim(),
        whats_new_description: description.trim() || null,
        whats_new_target_tab: targetTab === "__none__" ? null : targetTab,
        // Esse formulário só escolhe uma aba — limpa ação/seletor de elemento que possam ter
        // ficado de um aviso publicado antes por uma atualização da Central de Ajuda (ver
        // ChangelogSection.tsx), senão o clique aqui herdaria um alvo que não tem nada a ver.
        whats_new_target_action: null,
        whats_new_target_selector: null,
        // Muda sempre que publica — é essa data que decide, pra cada usuário, se o aviso já
        // foi visto (guardado no navegador dele) ou se precisa aparecer de novo.
        whats_new_published_at: new Date().toISOString(),
      });
      setEnabled(true);
      toast.success("Aviso publicado! Já vai aparecer pra todo mundo.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao publicar aviso");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (next: boolean) => {
    setEnabled(next);
    try {
      await updateAppSettings.mutateAsync({ whats_new_enabled: next });
      toast.success(next ? "Aviso reativado" : "Aviso desativado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar");
      setEnabled(!next);
    }
  };

  const isPublished = !!appSettingsQ.data?.whats_new_published_at;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Aviso de novidade
          </CardTitle>
          <CardDescription>
            Aparece como uma faixa clicável no topo do sistema pra todo mundo. Quem clicar é levado
            direto pra aba que você escolher abaixo. Editar e publicar de novo faz o aviso reaparecer
            até pra quem já tinha dispensado a versão anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPublished && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Aviso ativo</p>
                <p className="text-xs text-muted-foreground">Desligue pra parar de mostrar sem perder o texto escrito.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggleActive} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Novo! Personalize seu painel"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Agora você pode reordenar, ocultar e redimensionar os blocos do seu painel."
              maxLength={200}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Ao clicar, levar para</Label>
            <Select value={targetTab} onValueChange={setTargetTab}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Escolha uma aba (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (só mostra o aviso)</SelectItem>
                {TARGET_TABS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="button" onClick={handlePublish} disabled={saving} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {saving ? "Publicando..." : "Publicar aviso"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
