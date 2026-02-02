import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function Pending() {
  const location = useLocation();
  const navigate = useNavigate();

  const status = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    return (qs.get("status") ?? "pending") as "pending" | "rejected";
  }, [location.search]);

  const title = status === "rejected" ? "Acesso recusado" : "Aguardando aprovação";
  const desc =
    status === "rejected"
      ? "Seu acesso foi recusado. Se você acha que isso foi um engano, fale com o administrador."
      : "Seu cadastro foi criado e está pendente. Você só entra no painel após aprovação do administrador.";

  return (
    <div className="min-h-screen bg-hero-sheen">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Assim que o admin aprovar, é só fazer login normalmente.</p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
            >
              Voltar para login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
