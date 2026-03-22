import { useState } from "react";
import { CalendarDays, CalendarRange } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinFluxoCaixaTab } from "./components/FinFluxoCaixaTab";
import { FinVisaoAnualTab } from "./components/FinVisaoAnualTab";
import { FinMonthYearSelector } from "./components/FinMonthYearSelector";

type MainView = "mensal" | "anual";

export function FinanceiroPanel() {
  const now = new Date();
  const [mainView, setMainView] = useState<MainView>("mensal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-semibold tracking-tight">Financeiro</h2>
        <p className="text-sm text-muted-foreground">Controle financeiro completo da empresa.</p>
      </div>

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

      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.2s" }}>
        {mainView === "mensal" ? (
          <FinFluxoCaixaTab externalMonth={month} externalYear={year} />
        ) : (
          <FinVisaoAnualTab externalYear={year} />
        )}
      </div>
    </div>
  );
}
