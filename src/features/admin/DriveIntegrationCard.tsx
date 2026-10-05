import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FolderPlus, HardDrive, Plug, Unplug } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDisconnectDrive, useDriveStatus, useStartDriveConnect, useSyncDriveFolders } from "./hooks/use-drive-connection";

export function DriveIntegrationCard() {
  const statusQ = useDriveStatus();
  const start = useStartDriveConnect();
  const sync = useSyncDriveFolders();
  const disconnect = useDisconnectDrive();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const s = statusQ.data;
  const conn = s?.connection ?? null;
  const healthy = !!conn && conn.status === "active";
  const missing = s ? Math.max(0, s.clients - s.folders) : 0;

  const connect = () => start.mutate(undefined, { onSuccess: (url) => { window.location.href = url; } });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground"><HardDrive className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Google Drive da agência</p>
          <p className="text-xs text-muted-foreground">
            Conecte o seu Drive: o Fluxo cria uma pasta para a agência e uma para cada cliente, e guarda tudo na sua conta Google.
          </p>
        </div>
        {conn && (
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", healthy ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive")}>
            {healthy ? "Conectado" : conn.status === "revoked" ? "Acesso revogado" : "Com problema"}
          </span>
        )}
      </div>

      {statusQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : statusQ.isError ? (
        <p className="text-sm text-destructive">{statusQ.error instanceof Error ? statusQ.error.message : "Não foi possível ler o status do Drive."}</p>
      ) : !conn ? (
        <div className="space-y-3">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> O Fluxo só enxerga as pastas e arquivos que ele mesmo criar — o resto do seu Drive fica fora de alcance.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> Você pode desconectar a qualquer momento; suas pastas continuam no seu Drive.</li>
          </ul>
          <Button className="gap-1.5 rounded-full" disabled={start.isPending} onClick={connect}>
            <Plug className="h-4 w-4" /> Conectar Google Drive
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border/40 rounded-xl bg-muted/30 px-4">
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-muted-foreground">Conta Google</span><span className="truncate font-medium">{conn.google_email ?? "—"}</span></div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Pasta da agência</span>
              <a className="flex min-w-0 items-center gap-1 truncate font-medium hover:underline" href={`https://drive.google.com/drive/folders/${conn.root_folder_id}`} target="_blank" rel="noreferrer">
                <span className="truncate">{conn.root_folder_name}</span> <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5 text-sm"><span className="text-muted-foreground">Pastas de clientes</span><span className="font-medium">{s!.folders} de {s!.clients}</span></div>
          </div>

          {conn.last_error && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span className="min-w-0 break-words">{conn.last_error}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!healthy ? (
              <Button className="gap-1.5 rounded-full" disabled={start.isPending} onClick={connect}><Plug className="h-4 w-4" /> Reconectar</Button>
            ) : (
              <Button variant="outline" className="gap-1.5 rounded-full" disabled={sync.isPending || missing === 0} onClick={() => sync.mutate()}>
                <FolderPlus className="h-4 w-4" /> {missing > 0 ? `Criar ${missing} pasta${missing > 1 ? "s" : ""} que falta${missing > 1 ? "m" : ""}` : "Todas as pastas criadas"}
              </Button>
            )}
            <Button variant="ghost" className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDisconnect(true)}>
              <Unplug className="h-4 w-4" /> Desconectar
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Por enquanto os arquivos enviados dentro do app continuam no armazenamento padrão do Fluxo. A troca para este Drive é a próxima etapa.
          </p>
        </div>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              O Fluxo perde o acesso e esquece as pastas dos clientes. Nada é apagado: as pastas continuam no seu Drive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
