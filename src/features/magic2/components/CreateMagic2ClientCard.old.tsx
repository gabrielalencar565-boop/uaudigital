import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateMagic2Client } from "@/features/magic2/hooks/use-magic2";

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
});
type Values = z.infer<typeof schema>;

export function CreateMagic2ClientCard({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const create = useCreateMagic2Client();
  const [lastName, setLastName] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const subtitle = useMemo(() => {
    if (!lastName) return "Cadastre o primeiro cliente para começar o checklist e o dashboard.";
    return `Cliente “${lastName}” criado — agora você pode marcar as etapas.`;
  }, [lastName]);

  const onSubmit = async (v: Values) => {
    try {
      await create.mutateAsync({ name: v.name, year, startMonth: month });
      setLastName(v.name);
      form.reset({ name: "" });
      toast.success("Cliente criado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Começar do zero (Magic v2)</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-2">
          <Label htmlFor="magic2_client_name">Nome do cliente</Label>
          <Input id="magic2_client_name" placeholder="Ex.: Bucall Center" {...form.register("name")} />
          {form.formState.errors.name?.message ? (
            <p className="text-sm text-danger">{form.formState.errors.name.message}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="hero" disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Cadastrar cliente"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
