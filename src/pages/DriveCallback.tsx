import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeDrive, type DriveSyncResult } from "@/features/admin/hooks/use-drive-connection";

type Outcome =
  | { status: "loading" }
  | { status: "success"; email: string | null; folders: DriveSyncResult }
  | { status: "error"; message: string };

// The code/state pair is single-use, so the exchange is cached per state: this route can remount mid-flow
// (RequireAuth swapping its children) and every mount must await the same in-flight exchange.
const exchanges = new Map<string, Promise<Outcome>>();

async function exchange(code: string, state: string): Promise<Outcome> {
  try {
    const data = await invokeDrive<{ email: string | null; folders: DriveSyncResult }>({ action: "callback", code, state });
    return { status: "success", email: data.email, folders: data.folders };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export default function DriveCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>({ status: "loading" });

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      setOutcome({ status: "error", message: oauthError === "access_denied" ? "A permissão foi negada no Google." : oauthError });
      return;
    }
    if (!code || !state) {
      setOutcome({ status: "error", message: "Faltam parâmetros na resposta do Google." });
      return;
    }
    let promise = exchanges.get(state);
    if (!promise) {
      promise = exchange(code, state);
      exchanges.set(state, promise);
    }
    promise.then(setOutcome);
  }, [params]);

  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Conexão com o Google Drive</CardTitle>
            <CardDescription>
              {outcome.status === "loading" && "Finalizando a conexão e criando as pastas…"}
              {outcome.status === "success" && "Conexão concluída."}
              {outcome.status === "error" && "Não foi possível concluir a conexão."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {outcome.status === "success" && (
              <p>
                Conectado{outcome.email ? ` como ${outcome.email}` : ""}.{" "}
                {outcome.folders.created > 0
                  ? `Criei a pasta da agência e ${outcome.folders.created} pasta${outcome.folders.created > 1 ? "s" : ""} de cliente.`
                  : "A pasta da agência foi criada."}
                {outcome.folders.failures.length > 0 && ` ${outcome.folders.failures.length} pasta(s) não puderam ser criadas — tente de novo na tela da agência.`}
              </p>
            )}
            {outcome.status === "error" && <p>{outcome.message}</p>}
            {outcome.status !== "loading" && (
              <Button onClick={() => navigate("/configuracoes/aparencia", { replace: true })}>Voltar para a Agência</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
