import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateClient } from "@/features/data/queries";

const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome precisa ter pelo menos 2 caracteres")
    .max(120, "Nome muito longo (máx. 120 caracteres)"),
  notes: z.string().trim().max(500, "Observações muito longas (máx. 500 caracteres)").optional(),
});

type CreateClientValues = z.infer<typeof createClientSchema>;

export function CreateClientDialog({
  year,
  month,
  triggerLabel,
}: {
  year: number;
  month: number;
  triggerLabel?: string;
}) {
  const createClient = useCreateClient();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateClientValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: "", notes: "" },
  });

  const onCreate = async (v: CreateClientValues) => {
    try {
      const magic_due_date = `${year}-${String(month).padStart(2, "0")}-27`;
      await createClient.mutateAsync({
        name: v.name,
        magic_due_date,
        notes: v.notes || undefined,
      });
      toast.success("Cliente criado com sucesso! 🚀");
      setOpen(false);
      form.reset({ name: "", notes: "" });
    } catch (e: any) {
      const msg = e?.message ?? "Erro ao criar cliente";
      toast.error(msg.includes("duplicate") ? "Já existe um cliente com esse nome" : msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="brand" disabled={createClient.isPending}>
          {triggerLabel ?? "Cadastrar cliente"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar novo cliente</DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente para o mês {month}/{year}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onCreate)}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome do cliente *</Label>
            <Input
              id="name"
              placeholder="Ex.: Empresa ABC"
              autoFocus
              {...form.register("name")}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Notas internas sobre o cliente (opcional)"
              rows={3}
              {...form.register("notes")}
              aria-invalid={!!form.formState.errors.notes}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createClient.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="hero" disabled={createClient.isPending}>
              {createClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
