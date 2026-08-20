import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Outcome = { status: "loading" } | { status: "success"; message: string } | { status: "error"; message: string };

export default function InstagramCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>({ status: "loading" });
  // Meta's OAuth redirect can fire the effect twice in dev/StrictMode; the state row
  // is single-use server-side anyway, but this avoids a confusing "already used" flash.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error_description") || searchParams.get("error");

    if (oauthError) {
      setOutcome({ status: "error", message: oauthError });
      return;
    }
    if (!code || !state) {
      setOutcome({ status: "error", message: "Faltam parâmetros na resposta do Instagram." });
      return;
    }

    supabase.functions
      .invoke("instagram-connect", { body: { action: "callback", code, state } })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setOutcome({ status: "error", message: data?.error ?? String(error) });
          return;
        }
        setOutcome({
          status: "success",
          message: `Conectado à Página "${data.facebook_page_name}"${data.instagram_username ? ` (@${data.instagram_username})` : ""}.`,
        });
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Conexão com o Instagram</CardTitle>
            <CardDescription>
              {outcome.status === "loading" && "Finalizando a conexão..."}
              {outcome.status === "success" && "Conexão concluída."}
              {outcome.status === "error" && "Não foi possível concluir a conexão."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {outcome.status !== "loading" && <p>{outcome.message}</p>}
          </CardContent>
          <CardFooter>
            <Button type="button" disabled={outcome.status === "loading"} onClick={() => navigate("/", { replace: true })}>
              Voltar para o painel
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
