import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMagic2Client } from "@/features/magic2/hooks/use-magic2";
import { useClients } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  agendaClientId: z.string().uuid("Selecione um cliente da Agenda"),
});
type Values = z.infer<typeof schema>;

export function CreateMagic2ClientCard({ year, month }: { year: number; month: number }) {
  const qc = useQueryClient();
  const create = useCreateMagic2Client();
  const clientsQ = useClients();
  const [lastName, setLastName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { agendaClientId: "" },
  });

  const agendaClients = clientsQ.data ?? [];
  const subtitle = !lastName
    ? "Vincule um cliente da Agenda ao Magic Number (sincroniza tarefas concluídas)."
    : `"${lastName}" vinculado — tarefas concluídas aparecem no checklist.`;

  const onSubmit = async (v: Values) => {
    setLoading(true);
    try {
      const agendaCli = agendaClients.find((c) => c.id === v.agendaClientId);
      if (!agendaCli) throw new Error("Cliente não encontrado");

      const { clientId } = await create.mutateAsync({ name: agendaCli.name, year, startMonth: month });
      const link = await supabase
        .from("magic2_client_links")
        .insert({ magic2_client_id: clientId, agenda_client_id: v.agendaClientId });
      if (link.error) throw link.error;

      await qc.invalidateQueries({ queryKey: ["magic2"] });
      setLastName(agendaCli.name);
      form.reset({ agendaClientId: "" });
      toast.success(`Cliente "${agendaCli.name}" vinculado`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Começar do zero (Magic Number)</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-2">
          <Label htmlFor="magic2_client_agenda">Cliente da Agenda</Label>
          <Select value={form.watch("agendaClientId")} onValueChange={(val) => form.setValue("agendaClientId", val)}>
            <SelectTrigger id="magic2_client_agenda">
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
          {form.formState.errors.agendaClientId?.message ? (
            <p className="text-sm text-danger">{form.formState.errors.agendaClientId.message}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="hero" disabled={loading}>
            {loading ? "Vinculando..." : "Vincular cliente"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
