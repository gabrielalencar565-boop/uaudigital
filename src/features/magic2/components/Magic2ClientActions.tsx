import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useClients } from "@/features/data/queries";
import type { Magic2CycleRow } from "@/features/magic2/hooks/use-magic2";
import { useCreateMagic2Client, useDeactivateMagic2ClientFromMonth, useSyncMagic2Year } from "@/features/magic2/hooks/use-magic2";
import { supabase } from "@/integrations/supabase/client";
import { CreateClientDialog } from "@/features/magic/components/CreateClientDialog";

type Props = {
  year: number;
  month: number;
  cycles: Magic2CycleRow[];
};

export function Magic2ClientActions({ year, month, cycles }: Props) {
  const qc = useQueryClient();
  const clientsQ = useClients();
  const create = useCreateMagic2Client();
  const deactivate = useDeactivateMagic2ClientFromMonth();
  const sync = useSyncMagic2Year();

  const [addAgendaClientId, setAddAgendaClientId] = useState<string>("");
  const [removeClientId, setRemoveClientId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const magicClients = useMemo(() => {
    const seen = new Set<string>();
    const list: { clientId: string; name: string }[] = [];
    for (const c of cycles) {
      if (seen.has(c.client_id)) continue;
      seen.add(c.client_id);
      list.push({ clientId: c.client_id, name: c.magic2_clients?.name ?? "Cliente" });
    }
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
    return list.sort((a, b) => collator.compare(a.name, b.name));
  }, [cycles]);

  const onAdd = async () => {
    try {
      const agendaCli = (clientsQ.data ?? []).find((c) => c.id === addAgendaClientId);
      if (!agendaCli) throw new Error("Selecione um cliente da Agenda");

      const { clientId } = await create.mutateAsync({ name: agendaCli.name, year, startMonth: month });
      const link = await supabase
        .from("magic2_client_links")
        .insert({ magic2_client_id: clientId, agenda_client_id: agendaCli.id });
      if (link.error) throw link.error;

      await qc.invalidateQueries({ queryKey: ["magic2"] });
      toast.success(`Cliente "${agendaCli.name}" adicionado no Magic Number`);
      setAddAgendaClientId("");
      setAddOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar cliente");
    }
  };

  const onRemove = async () => {
    try {
      const cli = magicClients.find((c) => c.clientId === removeClientId);
      if (!cli) throw new Error("Selecione um cliente do checklist");

      await deactivate.mutateAsync({ clientId: cli.clientId, year, fromMonth: month });
      toast.success(`Cliente removido a partir de ${String(month).padStart(2, "0")}/${year}: ${cli.name}`);
      setRemoveClientId("");
      setRemoveOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover cliente");
    }
  };

  const busy = create.isPending || deactivate.isPending || sync.isPending;
  const agendaClients = clientsQ.data ?? [];

  return (
    <section className="space-y-2">
      <div>
        <div className="text-sm font-semibold">Clientes</div>
        <div className="text-xs text-muted-foreground">
          Remover aqui desativa o cliente do mês selecionado em diante (meses anteriores ficam intactos).
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Botão principal: criar novo cliente do zero */}
        <CreateClientDialog year={year} month={month} triggerLabel="Cadastrar novo cliente" />

        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            try {
              await sync.mutateAsync({ year });
              toast.success(`Sincronizado com a Agenda para ${year}`);
            } catch (e: any) {
              toast.error(e?.message ?? "Erro ao sincronizar");
            }
          }}
        >
          {sync.isPending ? "Sincronizando..." : "Sincronizar com Agenda"}
        </Button>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="hero" disabled={busy}>
              Adicionar cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar cliente</DialogTitle>
              <DialogDescription>
                Vincula um cliente da Agenda ao Magic Number a partir de {String(month).padStart(2, "0")}/{year}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Cliente da Agenda</Label>
              <Select value={addAgendaClientId} onValueChange={setAddAgendaClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {agendaClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setAddOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="hero" disabled={busy || !addAgendaClientId} onClick={onAdd}>
                {create.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={busy || magicClients.length === 0}>
              Remover cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remover cliente</DialogTitle>
              <DialogDescription>
                Remove (desativa) o cliente a partir de {String(month).padStart(2, "0")}/{year}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Cliente do checklist</Label>
              <Select value={removeClientId} onValueChange={setRemoveClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {magicClients.map((c) => (
                    <SelectItem key={c.clientId} value={c.clientId}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setRemoveOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={busy || !removeClientId} onClick={onRemove}>
                {deactivate.isPending ? "Removendo..." : "Remover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
