import { useState } from "react";
import { Users, Building2, SprayCan, Trophy, Paintbrush } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminPanel } from "./AdminPanel";
import { AdminClientesPanel } from "./AdminClientesPanel";
import { AdminLimpezaPanel } from "./AdminLimpezaPanel";
import { AdminPontuacaoPanel } from "./AdminPontuacaoPanel";
import { AdminBrandingPanel } from "./AdminBrandingPanel";

type AdminSubTab = "usuarios" | "clientes" | "limpeza" | "pontuacao" | "branding";

export function AdminContainer() {
  const [subTab, setSubTab] = useState<AdminSubTab>("usuarios");

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between opacity-0"
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Administração</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários, clientes e identidade visual do sistema.
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
          <TabsTrigger value="branding" className="gap-2">
            <Paintbrush className="h-4 w-4" />
            Branding
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

        <TabsContent value="branding" className="mt-6">
          <AdminBrandingPanel />
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
