import { PropsWithChildren, useMemo } from "react";
import { Trophy, Target, CalendarDays, LogOut, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export type MainTab = "visao_do_dia" | "desempenho" | "magic" | "agenda";

export function UauShell({ children, tab, onTabChange }: PropsWithChildren<{ tab: MainTab; onTabChange: (t: MainTab) => void }>) {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const subtitle = useMemo(() => {
    if (!user) return "";
    return isAdmin ? "Modo Gestor" : "Modo Colaborador";
  }, [isAdmin, user]);

  const onLogout = async () => {
    await supabase.auth.signOut();
    toast.message("Até já — mantendo o ritmo!");
  };

  return (
    <div className="min-h-screen bg-hero-sheen" style={{ willChange: "background" }}>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Uau Digital • Sistema interno</p>
            <h1 className="truncate text-lg font-semibold tracking-tight">Painel de Operações</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={tab} onValueChange={(v) => onTabChange(v as MainTab)}>
              <TabsList className="bg-card/40">
                <TabsTrigger value="visao_do_dia" className="gap-2">
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Visão do dia</span>
                </TabsTrigger>
                <TabsTrigger value="desempenho" className="gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">Desempenho</span>
                </TabsTrigger>
                <TabsTrigger value="magic" className="gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Magic Number</span>
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">Agenda</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" onClick={onLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-6xl px-6 py-8"
        onPointerMove={(e) => {
          const el = e.currentTarget.parentElement;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          el.style.setProperty("--spotlight-x", `${x}%`);
          el.style.setProperty("--spotlight-y", `${y}%`);
        }}
      >
        {children}
      </main>
    </div>
  );
}
