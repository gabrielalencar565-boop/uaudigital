import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useCloseMagic2Month, useMagic2Closure, useReopenMagic2Month } from "@/features/magic2/hooks/use-magic2";

type Props = {
  year: number;
  month: number;
  totalStages: number;
  doneStages: number;
  overallPct: number;
  // dia da última etapa concluída; vira a data de conclusão guardada no fechamento
  completedAt?: string | null;
  // o controle fica sobre o cartão roxo da Visão Geral: texto claro; no checklist usa as cores do tema
  onGradient?: boolean;
};

export function Magic2CloseControl({ year, month, totalStages, doneStages, overallPct, completedAt, onGradient }: Props) {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const closureQ = useMagic2Closure(year, month);
  const close = useCloseMagic2Month();
  const reopen = useReopenMagic2Month();
  const [confirm, setConfirm] = useState<"close" | "reopen" | null>(null);

  const closure = closureQ.data;
  const monthName = format(new Date(year, month - 1, 1), "MMMM", { locale: ptBR });

  const pill = onGradient
    ? "bg-white/15 text-white"
    : "bg-success/15 text-success";
  const ghost = onGradient
    ? "border-white/30 text-white hover:bg-white/15"
    : "border-border text-foreground hover:bg-muted/50";

  let body: React.ReactNode = null;
  if (closure) {
    body = (
      <div className="flex flex-wrap items-center gap-2 self-start">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${pill}`}>
          <Lock className="h-3 w-3" />
          Fechado em {format(parseISO(closure.closed_at), "dd/MM 'às' HH:mm", { locale: ptBR })} · {closure.pct}%
        </span>
        {isAdmin && (
          <button type="button" className={`text-xs underline underline-offset-2 ${onGradient ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setConfirm("reopen")}>
            Reabrir
          </button>
        )}
      </div>
    );
  } else if (isAdmin && totalStages > 0 && overallPct === 100) {
    body = (
      <button type="button" className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${ghost}`} onClick={() => setConfirm("close")}>
        <Lock className="h-3.5 w-3.5" /> Fechar ciclo de {monthName}
      </button>
    );
  }

  if (!body && !confirm) return null;

  return (
    <>
      {body}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "reopen" ? `Reabrir o ciclo de ${monthName}?` : `Fechar o ciclo de ${monthName}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "reopen"
                ? "As etapas voltam a poder ser desmarcadas e o resultado guardado é apagado."
                : `O resultado fica guardado (${doneStages}/${totalStages} etapas · ${overallPct}%) e ninguém mais consegue desmarcar etapas desse mês. Só um administrador pode reabrir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  if (confirm === "reopen") {
                    await reopen.mutateAsync({ year, month });
                    toast.success("Ciclo reaberto.");
                  } else if (user) {
                    await close.mutateAsync({ year, month, userId: user.id, totalStages, doneStages, pct: overallPct, concludedAt: completedAt });
                    toast.success(`Ciclo de ${monthName} fechado em ${overallPct}%.`);
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Não foi possível concluir");
                }
              }}
            >
              {confirm === "reopen" ? <><LockOpen className="mr-1.5 h-4 w-4" />Sim, reabrir</> : <><Lock className="mr-1.5 h-4 w-4" />Sim, fechar ciclo</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
