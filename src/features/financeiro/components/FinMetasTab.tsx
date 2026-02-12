import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarDays, CalendarRange } from "lucide-react";
import { FinMetasMensalTab } from "./FinMetasMensalTab";
import { FinMetasAnualTab } from "./FinMetasAnualTab";

export function FinMetasTab() {
  return (
    <Tabs defaultValue="mensal" className="space-y-4">
      <TabsList>
        <TabsTrigger value="mensal" className="gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Mensal
        </TabsTrigger>
        <TabsTrigger value="anual" className="gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" /> Anual
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mensal">
        <FinMetasMensalTab />
      </TabsContent>
      <TabsContent value="anual">
        <FinMetasAnualTab />
      </TabsContent>
    </Tabs>
  );
}
