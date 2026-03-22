import { useState } from "react";
import { Users, Receipt, FileSpreadsheet, ArrowRightLeft, ChevronDown, ChevronUp, CalendarDays, CalendarRange } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { FinClientesTab } from "./components/FinClientesTab";
import { FinReceitasDespesasTab } from "./components/FinReceitasDespesasTab";
import { FinDespesasDetalhadasTab } from "./components/FinDespesasDetalhadasTab";
import { FinLancamentosTab } from "./components/FinLancamentosTab";
import { FinFluxoCaixaTab } from "./components/FinFluxoCaixaTab";
import { FinVisaoAnualTab } from "./components/FinVisaoAnualTab";
import { FinMonthYearSelector } from "./components/FinMonthYearSelector";

type MainView = "mensal" | "anual";
type SubTab = "clientes" | "receitas_despesas" | "despesas_detalhadas" | "lancamentos";

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<any> }[] = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "receitas_despesas", label: "Receitas & Despesas", icon: Receipt },
  { key: "despesas_detalhadas", label: "Despesas Detalhadas", icon: FileSpreadsheet },
  { key: "lancamentos", label: "Lançamentos", icon: ArrowRightLeft },
];

export function FinanceiroPanel() {
  const now = new Date();
  const [mainView, setMainView] = useState<MainView>("mensal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subTab, setSubTab] = useState<SubTab>("clientes");
  const [subOpen, setSubOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-semibold tracking-tight">Financeiro</h2>
        <p className="text-sm text-muted-foreground">Controle financeiro completo da empresa.</p>
      </div>

      {/* Main header: Mensal / Anual tabs + selectors */}
      <div className="opacity-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.1s" }}>
        <Tabs value={mainView} onValueChange={(v) => setMainView(v as MainView)}>
          <TabsList>
            <TabsTrigger value="mensal" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> Mensal
            </TabsTrigger>
            <TabsTrigger value="anual" className="gap-1.5">
              <CalendarRange className="h-4 w-4" /> Anual
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <FinMonthYearSelector
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
          yearOnly={mainView === "anual"}
        />
      </div>

      {/* Main content */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.2s" }}>
        {mainView === "mensal" ? (
          <FinFluxoCaixaTab externalMonth={month} externalYear={year} />
        ) : (
          <FinVisaoAnualTab externalYear={year} />
        )}
      </div>

      {/* Collapsible sub-tabs */}
      <Collapsible open={subOpen} onOpenChange={setSubOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between gap-2 py-3 text-muted-foreground hover:text-foreground">
            <span className="text-sm font-medium">Mais detalhes</span>
            {subOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
            <TabsList className="inline-flex w-max">
              {SUB_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5 whitespace-nowrap">
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="clientes" className="mt-6"><FinClientesTab /></TabsContent>
            <TabsContent value="receitas_despesas" className="mt-6"><FinReceitasDespesasTab /></TabsContent>
            <TabsContent value="despesas_detalhadas" className="mt-6"><FinDespesasDetalhadasTab /></TabsContent>
            <TabsContent value="lancamentos" className="mt-6"><FinLancamentosTab /></TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
