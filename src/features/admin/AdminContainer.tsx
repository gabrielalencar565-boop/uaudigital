import { useState } from "react";
import { Users, Building2, SprayCan, Trophy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminPanel } from "./AdminPanel";
import { AdminClientesPanel } from "./AdminClientesPanel";
import { AdminLimpezaPanel } from "./AdminLimpezaPanel";
import { AdminPontuacaoPanel } from "./AdminPontuacaoPanel";

type AdminSubTab = "usuarios" | "clientes" | "limpeza" | "pontuacao";

export function AdminContainer() {
  const [subTab, setSubTab] = useState<AdminSubTab>("usuarios");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Administração</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários e clientes do sistema.
          </p>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as AdminSubTab)}>
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="limpeza" className="gap-2">
            <SprayCan className="h-4 w-4" />
            Limpeza
          </TabsTrigger>
          <TabsTrigger value="pontuacao" className="gap-2">
            <Trophy className="h-4 w-4" />
            Pontuação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          <AdminPanel />
        </TabsContent>

        <TabsContent value="clientes" className="mt-6">
          <AdminClientesPanel />
        </TabsContent>

        <TabsContent value="limpeza" className="mt-6">
          <AdminLimpezaPanel />
        </TabsContent>

        <TabsContent value="pontuacao" className="mt-6">
          <AdminPontuacaoPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
