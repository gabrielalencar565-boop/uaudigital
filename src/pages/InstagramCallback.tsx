import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type PageOption = { facebook_page_id: string; facebook_page_name: string; instagram_username: string | null };

type Outcome =
  | { status: "loading" }
  | { status: "select"; state: string; options: PageOption[] }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

// supabase-js doesn't surface the response body for non-2xx invokes by default — the
// actual `{ error: "..." }` our function returned is on error.context (the raw Response),
// so read it there instead of falling back to the generic "Edge Function returned a
// non-2xx status code".
async function extractError(data: { error?: string } | null, error: unknown): Promise<string> {
  if (data?.error) return data.error;
  if (error && typeof error === "object" && "context" in error) {
    try {
      const body = await (error as { context: Response }).context.json();
      if (body?.error) return body.error as string;
    } catch {
      // context wasn't JSON — fall through to the generic error string below.
    }
  }
  return String(error);
}

export default function InstagramCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<Outcome>({ status: "loading" });
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
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
      .then(async ({ data, error }) => {
        if (error || data?.error) {
          setOutcome({ status: "error", message: await extractError(data, error) });
          return;
        }
        if (data.needs_selection) {
          setOutcome({ status: "select", state: data.state, options: data.options as PageOption[] });
          return;
        }
        setOutcome({
          status: "success",
          message: `Conectado à Página "${data.facebook_page_name}"${data.instagram_username ? ` (@${data.instagram_username})` : ""}.`,
        });
      });
  }, [searchParams]);

  async function confirmSelection() {
    if (outcome.status !== "select" || !selectedPageId) return;
    setConfirming(true);
    const { data, error } = await supabase.functions.invoke("instagram-connect", {
      body: { action: "select_page", state: outcome.state, facebook_page_id: selectedPageId },
    });
    if (error || data?.error) {
      setOutcome({ status: "error", message: await extractError(data, error) });
      return;
    }
    setOutcome({
      status: "success",
      message: `Conectado à Página "${data.facebook_page_name}"${data.instagram_username ? ` (@${data.instagram_username})` : ""}.`,
    });
  }

  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Conexão com o Instagram</CardTitle>
            <CardDescription>
              {outcome.status === "loading" && "Finalizando a conexão..."}
              {outcome.status === "select" && "Essa conta administra mais de uma Página — escolha qual conectar a este cliente."}
              {outcome.status === "success" && "Conexão concluída."}
              {outcome.status === "error" && "Não foi possível concluir a conexão."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(outcome.status === "success" || outcome.status === "error") && <p>{outcome.message}</p>}
            {outcome.status === "select" && (
              <RadioGroup value={selectedPageId} onValueChange={setSelectedPageId} className="space-y-2">
                {outcome.options.map((opt) => (
                  <div key={opt.facebook_page_id} className="flex items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value={opt.facebook_page_id} id={opt.facebook_page_id} />
                    <Label htmlFor={opt.facebook_page_id} className="flex-1 cursor-pointer font-normal">
                      <span className="font-medium text-foreground">{opt.facebook_page_name}</span>
                      {opt.instagram_username && <span className="ml-1 text-muted-foreground">(@{opt.instagram_username})</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            {outcome.status === "select" ? (
              <Button type="button" disabled={!selectedPageId || confirming} onClick={confirmSelection}>
                {confirming ? "Conectando..." : "Confirmar"}
              </Button>
            ) : (
              <Button type="button" disabled={outcome.status === "loading"} onClick={() => navigate("/", { replace: true })}>
                Voltar para o painel
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
