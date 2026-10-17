import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Instagram, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ConversasPanel } from "@/features/conversas/ConversasPanel";
import { ComercialContext, type ComercialCtx, type ComercialView } from "./ComercialContext";
import { GanhoDialog, NovaAtividadeDialog, NovoLeadDialog, PerdaDialog } from "./components/Dialogs";
import { ClientDrawer, LeadDrawer } from "./components/Drawers";
import {
  useActivities, useClientTasks, useComercialClients, useContactedLeadIds, useLeads, useStages, useTeam, useUnreadChats, useUpdateLead,
} from "./hooks/use-comercial";
import { attentionCount, attentionGroups, diffDays, isOpenStage, nextActivity, todayBR, type Lead } from "./lib/rules";
import { sendWhatsApp, sendWhatsAppAudio, useCloudStatus, useZapiStatus } from "./hooks/use-whatsapp-cloud";
import { Atividades } from "./views/Atividades";
import { Biblioteca } from "./views/Biblioteca";
import { Automacoes } from "./views/Automacoes";
import { Configuracoes } from "./views/Configuracoes";
import { EmBreve } from "./views/EmBreve";
import { Formularios } from "./views/Formularios";
import { Funil } from "./views/Funil";
import { Leads } from "./views/Leads";
import { Onboarding } from "./views/Onboarding";
import { VisaoGeral } from "./views/VisaoGeral";

interface NavItem { view: ComercialView; label: string; soon?: boolean }
interface NavGroup { key: string; label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  { key: "comercial", label: "Comercial", items: [
    { view: "overview", label: "Visão geral" }, { view: "funil", label: "Funil comercial" }, { view: "leads", label: "Leads e contatos" }, { view: "acts", label: "Atividades" },
  ] },
  { key: "conversas", label: "Conversas", items: [
    { view: "chat", label: "Todas" }, { view: "chat_wa", label: "WhatsApp" }, { view: "chat_ig", label: "Instagram", soon: true }, { view: "chat_em", label: "E-mail", soon: true },
  ] },
  { key: "automacao", label: "Automação", items: [
    { view: "autos", label: "Automações" }, { view: "forms", label: "Formulários" }, { view: "lib", label: "Biblioteca de modelos" },
  ] },
  { key: "clientes", label: "Clientes", items: [{ view: "onb", label: "Onboarding" }] },
  { key: "ajustes", label: "Ajustes", items: [{ view: "cfg", label: "Configurações" }] },
];

const VIEWS = GROUPS.flatMap((g) => g.items.map((i) => i.view));
const groupOf = (view: ComercialView) => GROUPS.find((g) => g.items.some((i) => i.view === view)) ?? GROUPS[0];

function Count({ n, tone }: { n: number; tone?: "alert" | "new" }) {
  if (!n) return null;
  return (
    <span className={cn("ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums", tone === "alert" ? "bg-red-500 text-white" : tone === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
      {n}
    </span>
  );
}

export function ComercialPanel() {
  const [params, setParams] = useSearchParams();
  const rawView = params.get("v") as ComercialView | null;
  const view: ComercialView = rawView && VIEWS.includes(rawView) ? rawView : "overview";
  const leadId = params.get("lead");

  const stagesQ = useStages();
  const leadsQ = useLeads();
  const actsQ = useActivities();
  const clientsQ = useComercialClients();
  const tasksQ = useClientTasks();
  const teamQ = useTeam();
  const contactedQ = useContactedLeadIds();
  const unreadQ = useUnreadChats();
  const cloudQ = useCloudStatus();
  const zapiQ = useZapiStatus();
  const updateLead = useUpdateLead();

  const stages = stagesQ.data ?? [];
  const leads = leadsQ.data ?? [];
  const acts = actsQ.data ?? [];
  const clients = clientsQ.data ?? [];
  const clientTasks = tasksQ.data ?? [];
  const team = teamQ.data ?? [];
  const contacted = contactedQ.data ?? new Set<string>();
  const today = todayBR();

  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [activityDlg, setActivityDlg] = useState<{ open: boolean; leadId?: string }>({ open: false });
  const [loss, setLoss] = useState<{ lead: Lead; stageId: string } | null>(null);
  const [win, setWin] = useState<{ lead: Lead; stageId: string } | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const stageOf = useCallback((id: string) => stages.find((s) => s.id === id), [stages]);
  const memberOf = useCallback((id: string | null | undefined) => (id ? team.find((m) => m.user_id === id) : undefined), [team]);
  const leadOf = useCallback((id: string) => leads.find((l) => l.id === id), [leads]);

  const setParam = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
      return next;
    }, { replace: true });
  }, [setParams]);

  const moveLead = useCallback((lead: Lead, stageId: string) => {
    const target = stages.find((s) => s.id === stageId);
    if (!target || lead.stage_id === stageId) return;
    if (target.type === "lost") return setLoss({ lead, stageId });
    if (target.type === "won") return setWin({ lead, stageId });
    updateLead.mutate({ id: lead.id, patch: { stage_id: stageId } }, {
      onSuccess: () => {
        if (!nextActivity(lead.id, acts)) {
          toast("Defina a próxima ação desse lead");
          setActivityDlg({ open: true, leadId: lead.id });
        }
      },
    });
  }, [stages, acts, updateLead]);

  const ctx: ComercialCtx = {
    stages, leads, acts, clients, clientTasks, team, contacted, today, stageOf, memberOf, leadOf,
    openLead: (id) => setParam({ lead: id }),
    openClient: setClientId,
    newActivity: (id) => setActivityDlg({ open: true, leadId: id }),
    newLead: () => setNewLeadOpen(true),
    moveLead,
    goto: (v) => setParam({ v: v === "overview" ? null : v, lead: null, edit: null, form: null }),
  };

  // contadores do menu
  const counts = useMemo(() => {
    const open = leads.filter((l) => isOpenStage(stages.find((s) => s.id === l.stage_id)));
    const late = acts.filter((a) => !a.done && diffDays(a.due_date, today) < 0).length;
    const dueToday = acts.filter((a) => !a.done && diffDays(a.due_date, today) === 0).length;
    return {
      overview: attentionCount(attentionGroups(leads, stages, acts, clients, clientTasks, contacted, today)),
      funil: open.length,
      leads: leads.length,
      acts: late || dueToday,
      actsLate: late > 0,
      onb: clients.filter((c) => c.onboarding_stage !== "producao").length,
    };
  }, [leads, stages, acts, clients, clientTasks, contacted, today]);

  const countFor = (v: ComercialView) => {
    if (v === "overview") return <Count n={counts.overview} tone="alert" />;
    if (v === "funil") return <Count n={counts.funil} />;
    if (v === "leads") return <Count n={counts.leads} />;
    if (v === "acts") return <Count n={counts.acts} tone={counts.actsLate ? "alert" : undefined} />;
    if (v === "onb") return <Count n={counts.onb} />;
    if (v === "chat" || v === "chat_wa") return <Count n={unreadQ.data ?? 0} tone="new" />;
    return null;
  };

  const group = groupOf(view);
  const loading = stagesQ.isLoading || leadsQ.isLoading;

  const body = (() => {
    switch (view) {
      case "overview": return <VisaoGeral />;
      case "funil": return <Funil />;
      case "leads": return <Leads />;
      case "acts": return <Atividades />;
      case "chat": return <ConversasPanel connected={!!cloudQ.data?.connected || !!zapiQ.data?.connected} onConnect={() => ctx.goto("cfg")} onSend={sendWhatsApp} onSendAudio={sendWhatsAppAudio} />;
      case "chat_wa": return <ConversasPanel connected={!!cloudQ.data?.connected || !!zapiQ.data?.connected} onConnect={() => ctx.goto("cfg")} onSend={sendWhatsApp} onSendAudio={sendWhatsAppAudio} />;
      case "chat_ig": return <EmBreve title="Instagram Direct" icon={Instagram}>As mensagens do Direct vão chegar aqui junto com as do WhatsApp, cada uma no lead certo. Depende da conexão com o Instagram Messaging.</EmBreve>;
      case "chat_em": return <EmBreve title="E-mail" icon={Mail}>A caixa de entrada de e-mail por lead entra depois de escolhermos o provedor de envio e recebimento.</EmBreve>;
      case "autos": return <Automacoes />;
      case "forms": return <Formularios />;
      case "lib": return <Biblioteca />;
      case "onb": return <Onboarding />;
      case "cfg": return <Configuracoes />;
    }
  })();

  return (
    <TooltipProvider delayDuration={150}>
      <ComercialContext.Provider value={ctx}>
        <div className="space-y-4">
          {/* menu horizontal: grupos em cima, itens do grupo embaixo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1" aria-label="Grupos do CRM">
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => ctx.goto(g.items[0].view)}
                    aria-current={g.key === group.key ? "page" : undefined}
                    className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition", g.key === group.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
                  >
                    {g.label}
                  </button>
                ))}
              </nav>
              <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setNewLeadOpen(true)}><Plus className="h-4 w-4" /> Novo lead</Button>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-b border-border/50" aria-label={group.label}>
              {group.items.map((i) => (
                <button
                  key={i.view}
                  type="button"
                  onClick={() => ctx.goto(i.view)}
                  aria-current={i.view === view ? "page" : undefined}
                  className={cn("-mb-px flex shrink-0 items-center border-b-2 px-3 py-2 text-sm transition", i.view === view ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  {i.label}
                  {i.soon && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">em breve</span>}
                  {countFor(i.view)}
                </button>
              ))}
            </nav>
          </div>

          {stagesQ.isError || leadsQ.isError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              Não foi possível carregar o CRM. Só administradores da agência acessam o Comercial. Se você é administrador, recarregue a página.
            </div>
          ) : loading ? (
            <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
          ) : (
            body
          )}
        </div>

        <LeadDrawer leadId={leadId} onClose={() => setParam({ lead: null })} />
        <ClientDrawer clientId={clientId} onClose={() => setClientId(null)} />
        <NovoLeadDialog open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
        <NovaAtividadeDialog open={activityDlg.open} leadId={activityDlg.leadId} onClose={() => setActivityDlg({ open: false })} />
        <PerdaDialog lead={loss?.lead ?? null} stageId={loss?.stageId ?? null} onClose={() => setLoss(null)} />
        <GanhoDialog lead={win?.lead ?? null} stageId={win?.stageId ?? null} onClose={() => setWin(null)} />
      </ComercialContext.Provider>
    </TooltipProvider>
  );
}
