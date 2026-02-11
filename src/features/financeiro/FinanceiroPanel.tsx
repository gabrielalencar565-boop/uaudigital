import { useState } from "react";
import { Users, Receipt, FileSpreadsheet, ArrowRightLeft, BarChart3, CalendarRange, Target } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FinClientesTab } from "./components/FinClientesTab";
import { FinReceitasDespesasTab } from "./components/FinReceitasDespesasTab";
import { FinDespesasDetalhadasTab } from "./components/FinDespesasDetalhadasTab";
import { FinLancamentosTab } from "./components/FinLancamentosTab";
import { FinFluxoCaixaTab } from "./components/FinFluxoCaixaTab";
import { FinVisaoAnualTab } from "./components/FinVisaoAnualTab";
import { FinMetasTab } from "./components/FinMetasTab";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type FinSubTab = "clientes" | "receitas_despesas" | "despesas_detalhadas" | "lancamentos" | "fluxo_caixa" | "visao_anual" | "metas";

const TABS: { key: FinSubTab; label: string; icon: React.ComponentType<any> }[] = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "receitas_despesas", label: "Receitas & Despesas", icon: Receipt },
  { key: "despesas_detalhadas", label: "Despesas Detalhadas", icon: FileSpreadsheet },
  { key: "lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
  { key: "fluxo_caixa", label: "Fluxo de Caixa", icon: BarChart3 },
  { key: "visao_anual", label: "Visão Anual", icon: CalendarRange },
  { key: "metas", label: "Metas", icon: Target },
];

export function FinanceiroPanel() {
  const [subTab, setSubTab] = useState<FinSubTab>("clientes");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Financeiro</h2>
        <p className="text-sm text-muted-foreground">Controle financeiro completo da empresa.</p>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as FinSubTab)}>
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5 whitespace-nowrap">
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="clientes" className="mt-6"><FinClientesTab /></TabsContent>
        <TabsContent value="receitas_despesas" className="mt-6"><FinReceitasDespesasTab /></TabsContent>
        <TabsContent value="despesas_detalhadas" className="mt-6"><FinDespesasDetalhadasTab /></TabsContent>
        <TabsContent value="lancamentos" className="mt-6"><FinLancamentosTab /></TabsContent>
        <TabsContent value="fluxo_caixa" className="mt-6"><FinFluxoCaixaTab /></TabsContent>
        <TabsContent value="visao_anual" className="mt-6"><FinVisaoAnualTab /></TabsContent>
        <TabsContent value="metas" className="mt-6"><FinMetasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
