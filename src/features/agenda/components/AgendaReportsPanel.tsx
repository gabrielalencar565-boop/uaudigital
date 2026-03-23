import { useState } from "react";
import { FileText, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskActivityReport } from "./TaskActivityReport";
import { TaskTrashPanel } from "./TaskTrashPanel";

interface Props {
  onClose: () => void;
  isAdmin: boolean;
  defaultTab?: string;
}

export function AgendaReportsPanel({ onClose, isAdmin, defaultTab = "trash" }: Props) {
  const [tab, setTab] = useState(defaultTab);

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatórios & Lixeira
          </h2>
          <p className="text-sm text-muted-foreground">Histórico de atividades e tarefas removidas</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <TabsList className="w-full justify-start mb-4">
          {isAdmin && (
            <>
              <TabsTrigger value="dates" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Datas alteradas
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluídas
              </TabsTrigger>
              <TabsTrigger value="unchecked" className="gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Desmarcadas
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="trash" className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Lixeira
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <>
            <TabsContent value="dates" className="flex-1 overflow-hidden mt-0">
              <TaskActivityReport onClose={onClose} filterAction="date_changed" />
            </TabsContent>
            <TabsContent value="completed" className="flex-1 overflow-hidden mt-0">
              <TaskActivityReport onClose={onClose} filterAction="completed" />
            </TabsContent>
            <TabsContent value="unchecked" className="flex-1 overflow-hidden mt-0">
              <TaskActivityReport onClose={onClose} filterAction="uncompleted" />
            </TabsContent>
          </>
        )}
        <TabsContent value="trash" className="flex-1 overflow-hidden mt-0">
          <TaskTrashPanel onClose={onClose} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
