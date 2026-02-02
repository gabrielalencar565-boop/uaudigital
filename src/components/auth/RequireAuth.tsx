import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type AccessStatus = "none" | "pending" | "approved" | "rejected";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("none");
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setAccessStatus("none");
      setCheckingAccess(false);
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    setCheckingAccess(true);

    // 1) Admin nunca fica bloqueado por aprovação
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => {
        if (cancelled) return;
        const admin = Boolean(data);
        setIsAdmin(admin);
        if (admin) {
          setAccessStatus("none");
          setCheckingAccess(false);
          return;
        }

        // 2) Para não-admins: checa o status do pedido de acesso
        return supabase
          .from("access_requests")
          .select("status")
          .eq("user_id", user.id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(async ({ data, error }) => {
            if (cancelled) return;
            if (error) {
              // Em caso de erro, não bloqueia (evita travar o app)
              setAccessStatus("none");
              return;
            }
            if (!data?.status) {
              // Sem access_request: pode ser usuário antigo (legado) OU cadastro novo cujo request não foi criado.
              // Para não quebrar legado, usamos uma heurística segura:
              // - se NÃO existe role para o usuário, tratamos como pendente (mantém fora do painel)
              // - se existe role, consideramos legado e deixamos entrar
              try {
                const roles = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1);
                const hasAnyRole = !!roles.data && roles.data.length > 0;
                setAccessStatus(hasAnyRole ? "none" : "pending");
              } catch {
                // Se não conseguimos checar roles, não travamos o app.
                setAccessStatus("none");
              }
              return;
            }
            setAccessStatus(data.status as AccessStatus);
          })
          .then(() => {
            if (!cancelled) setCheckingAccess(false);
          });
      }, () => {
        if (cancelled) return;
        setIsAdmin(false);
        setAccessStatus("none");
        setCheckingAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  if (checkingAccess) return null;

  if (!isAdmin && (accessStatus === "pending" || accessStatus === "rejected")) {
    return <Navigate to={`/pending?status=${accessStatus}`} replace />;
  }

  return <>{children}</>;
}
