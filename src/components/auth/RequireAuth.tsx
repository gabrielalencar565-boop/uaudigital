import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

type AccessStatus = "none" | "pending" | "approved" | "rejected";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("none");
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Signed in but not in any agency yet, or the owner of an agency that has not finished the guided setup
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setAccessStatus("none");
      setCheckingAccess(false);
      setIsAdmin(false);
      setNeedsOnboarding(false);
      return;
    }

    let cancelled = false;
    setCheckingAccess(true);

    const run = async () => {
      const sb = supabase as any;
      const [agencyRes, adminRes] = await Promise.all([
        sb.rpc("current_agency_id"),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      ]);
      if (cancelled) return;
      const agencyId = (agencyRes.data as string | null) ?? null;
      const admin = Boolean(adminRes.data);
      setIsAdmin(admin);

      // 1) Not in an agency yet: a legacy pending/rejected request keeps the old waiting screen;
      //    anyone else is a new owner and goes through the agency setup.
      if (!agencyId && !agencyRes.error) {
        const ar = await supabase
          .from("access_requests")
          .select("status")
          .eq("user_id", user.id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const st = ar.data?.status as AccessStatus | undefined;
        if (st === "pending" || st === "rejected") {
          setAccessStatus(st);
          setNeedsOnboarding(false);
        } else {
          setAccessStatus("none");
          setNeedsOnboarding(true);
        }
        setCheckingAccess(false);
        return;
      }

      // 2) Owner of an agency that has not finished the guided setup
      if (agencyId && admin) {
        const ag = await sb.from("agencies").select("owner_id,onboarded_at").eq("id", agencyId).maybeSingle();
        if (cancelled) return;
        setNeedsOnboarding(ag.data?.owner_id === user.id && !ag.data?.onboarded_at);
      } else {
        setNeedsOnboarding(false);
      }

      // 3) Admin nunca fica bloqueado por aprovação
      if (admin) {
        setAccessStatus("none");
        setCheckingAccess(false);
        return;
      }

      // 4) Para não-admins: checa o status do pedido de acesso
      const { data, error } = await supabase
        .from("access_requests")
        .select("status")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Em caso de erro, não bloqueia (evita travar o app)
        setAccessStatus("none");
      } else if (!data?.status) {
        // Sem access_request: pode ser usuário antigo (legado) OU cadastro novo cujo request não foi criado.
        // Para não quebrar legado, usamos uma heurística segura:
        // - se NÃO existe role para o usuário, tratamos como pendente (mantém fora do painel)
        // - se existe role, consideramos legado e deixamos entrar
        try {
          const roles = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1);
          const hasAnyRole = !!roles.data && roles.data.length > 0;
          if (!cancelled) setAccessStatus(hasAnyRole ? "none" : "pending");
        } catch {
          // Se não conseguimos checar roles, não travamos o app.
          if (!cancelled) setAccessStatus("none");
        }
      } else {
        setAccessStatus(data.status as AccessStatus);
      }
      if (!cancelled) setCheckingAccess(false);
    };

    run().catch(() => {
      if (cancelled) return;
      setIsAdmin(false);
      setNeedsOnboarding(false);
      setAccessStatus("none");
      setCheckingAccess(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (checkingAccess) return <AuthLoading />;

  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  if (!isAdmin && (accessStatus === "pending" || accessStatus === "rejected")) {
    return <Navigate to={`/pending?status=${accessStatus}`} replace />;
  }

  return <>{children}</>;
}
