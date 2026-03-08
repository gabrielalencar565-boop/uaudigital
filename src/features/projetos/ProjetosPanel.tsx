import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VisaoGeralTab } from "./components/VisaoGeralTab";
import { HealthScoreTab } from "./components/HealthScoreTab";
import { BarChart3, HeartPulse } from "lucide-react";

export function ProjetosPanel() {
  const [tab, setTab] = useState("visao_geral");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
        <p className="text-sm text-muted-foreground">Visão geral de squads, tarefas e saúde dos clientes</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="visao_geral" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="health_score" className="gap-1.5">
            <HeartPulse className="h-4 w-4" /> Health Score
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao_geral">
          <VisaoGeralTab />
        </TabsContent>
        <TabsContent value="health_score">
          <HealthScoreTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
