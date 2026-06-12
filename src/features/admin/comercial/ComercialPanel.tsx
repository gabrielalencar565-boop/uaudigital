import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useCrmLeads, useCreateLead, useUpdateLead, type CrmLead } from "./hooks/use-crm-leads";
import { useCrmTasks } from "./hooks/use-crm-tasks";
import { useCrmProposals } from "./hooks/use-crm-proposals";
import { STAGES, ORIGEM_OPTIONS, type CrmStage } from "./crm-constants";
import { ComercialDashboard } from "./components/ComercialDashboard";
import { FunilKanban } from "./components/FunilKanban";
import { LeadDetailSheet } from "./components/LeadDetailSheet";
import { LossReasonDialog } from "./components/LossReasonDialog";
import { ComercialTasksTab } from "./components/ComercialTasksTab";
import { ComercialProposalsTab } from "./components/ComercialProposalsTab";
import { ComercialRelatoriosTab } from "./components/ComercialRelatoriosTab";
import { ComercialAutomacoesTab } from "./components/ComercialAutomacoesTab";

export function ComercialPanel() {
  const { data: leads = [] } = useCrmLeads();
  const { data: tasks = [] } = useCrmTasks();
  const { data: proposals = [] } = useCrmProposals();
  const create = useCreateLead();
  const update = useUpdateLead();

  const members = useQuery({
    queryKey: ["crm-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members")
        .select("user_id, display_name, avatar_url, role_title, is_active")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []).filter((m) => !!m.user_id) as any[];
    },
  });

  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);
  const [filterResp, setFilterResp] = useState<string>("all");
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // For drag-drop "perdido"
  const [pendingLossLead, setPendingLossLead] = useState<CrmLead | null>(null);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterResp !== "all" && l.responsavel_id !== (filterResp === "none" ? null : filterResp)) return false;
      if (filterOrigem !== "all" && (l.origem ?? "") !== filterOrigem) return false;
      if (filterStage !== "all" && l.stage !== filterStage) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = `${l.nome} ${l.empresa ?? ""} ${l.telefone ?? ""} ${l.cidade ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [leads, filterResp, filterOrigem, filterStage, search]);

  const handleStageChange = async (lead: CrmLead, newStage: CrmStage) => {
    if (newStage === "perdido") {
      setPendingLossLead(lead);
      return;
    }
    try {
      await update.mutateAsync({ id: lead.id, patch: { stage: newStage, loss_reason: null } });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const openLead = (id: string) => {
    const l = leads.find((x) => x.id === id);
    if (l) setActiveLead(l);
  };

  // Sync activeLead when leads updates
  const syncedActive = useMemo(() => activeLead ? leads.find((l) => l.id === activeLead.id) ?? null : null, [leads, activeLead]);

  const proposalsEnviadas = proposals.filter((p) => p.status === "enviada" || p.status === "aceita").length;
  const reunioesMarcadas = tasks.filter((t) => t.tipo === "reuniao" && t.status === "pendente").length;

  return (
    <div className="space-y-4">
      <ComercialDashboard leads={filtered} proposalsEnviadas={proposalsEnviadas} reunioesMarcadas={reunioesMarcadas} />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-3 bg-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lead..." className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterResp} onValueChange={setFilterResp}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos resp.</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {(members.data ?? []).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />Novo lead</Button>
      </div>

      <Tabs defaultValue="funil">
        <TabsList>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
        </TabsList>
        <TabsContent value="funil" className="mt-4">
          <FunilKanban
            leads={filtered}
            tasks={tasks}
            members={members.data ?? []}
            onLeadStageChange={handleStageChange}
            onLeadClick={(l) => setActiveLead(l)}
          />
        </TabsContent>
        <TabsContent value="tarefas" className="mt-4">
          <ComercialTasksTab onOpenLead={openLead} />
        </TabsContent>
        <TabsContent value="propostas" className="mt-4">
          <ComercialProposalsTab onOpenLead={openLead} />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <ComercialRelatoriosTab members={members.data ?? []} />
        </TabsContent>
        <TabsContent value="automacoes" className="mt-4">
          <ComercialAutomacoesTab />
        </TabsContent>
      </Tabs>

      <LeadDetailSheet
        lead={syncedActive}
        open={!!activeLead}
        onOpenChange={(o) => !o && setActiveLead(null)}
        members={members.data ?? []}
      />

      <LossReasonDialog
        open={!!pendingLossLead}
        onCancel={() => setPendingLossLead(null)}
        onConfirm={async (reason) => {
          if (!pendingLossLead) return;
          try {
            await update.mutateAsync({ id: pendingLossLead.id, patch: { stage: "perdido", loss_reason: reason } });
            toast.success("Lead marcado como perdido");
          } catch (e: any) { toast.error(e?.message ?? "Erro"); }
          finally { setPendingLossLead(null); }
        }}
      />

      <NewLeadDialog open={showCreate} onOpenChange={setShowCreate} onCreate={(data) => create.mutateAsync(data as any).then(
        () => { toast.success("Lead criado"); setShowCreate(false); },
        (e) => toast.error(e?.message ?? "Erro"),
      )} />
    </div>
  );
}

function NewLeadDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (data: Partial<CrmLead>) => void }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [origem, setOrigem] = useState("whatsapp");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Empresa</Label><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!nome.trim()} onClick={() => onCreate({ nome: nome.trim(), telefone: telefone || null, empresa: empresa || null, origem, stage: "novo_lead" })}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
