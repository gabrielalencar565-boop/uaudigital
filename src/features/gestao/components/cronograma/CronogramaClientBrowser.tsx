import { useState, useMemo } from "react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FolderOpen, CalendarRange, Palette, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PmTask } from "../../pm-types";
import { PmCronogramaTab } from "../PmCronogramaTab";
import { PdfLayoutEditor } from "./PdfLayoutEditor";

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (t: PmTask) => void;
}

export function CronogramaClientBrowser({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"clientes" | "layout">("clientes");

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  // Group parent tasks by client, filter by month based on child posting_date
  const clientGroups = useMemo(() => {
    const groups: Record<string, { clientId: string; clientName: string; parentTasks: PmTask[]; postCount: number; thumbUrl: string | null }> = {};

    tasks.forEach(t => {
      const children = childTasksMap[t.id] ?? [];
      const monthChildren = children.filter(c => {
        if (!c.posting_date) return false;
        const d = new Date(c.posting_date + "T12:00:00");
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      if (monthChildren.length === 0) return;

      const cid = t.client_id;
      if (!groups[cid]) {
        groups[cid] = { clientId: cid, clientName: clientsMap[cid] ?? "—", parentTasks: [], postCount: 0, thumbUrl: null };
      }
      groups[cid].parentTasks.push(t);
      groups[cid].postCount += monthChildren.length;
      // Use first child's cover/attachment as thumb
      if (!groups[cid].thumbUrl) {
        const firstWithImg = monthChildren.find(c => c.cover_url);
        if (firstWithImg) groups[cid].thumbUrl = firstWithImg.cover_url;
      }
    });

    return Object.values(groups).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [tasks, childTasksMap, clientsMap, year, month]);

  const selectedGroup = selectedClientId ? clientGroups.find(g => g.clientId === selectedClientId) : null;

  // If a client is selected, show its cronograma
  if (selectedGroup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={() => setSelectedClientId(null)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">{selectedGroup.clientName}</h3>
            <Badge variant="secondary" className="text-[10px]">
              {format(cursor, "MMMM yyyy", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {selectedGroup.parentTasks.map(task => {
          // Filter children for current month only
          const allChildren = childTasksMap[task.id] ?? [];
          const monthChildren = allChildren.filter(c => {
            if (!c.posting_date) return false;
            const d = new Date(c.posting_date + "T12:00:00");
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          });
          if (monthChildren.length === 0) return null;

          return (
            <div key={task.id} className="space-y-2">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80" onClick={() => onTaskClick(task)}>
                <Badge className="text-[10px] bg-primary/10 text-primary border-0">{task.title}</Badge>
                <span className="text-xs text-muted-foreground">{monthChildren.length} postagens</span>
              </div>
              <PmCronogramaTab
                parentTask={task}
                childTasks={monthChildren}
                clientName={selectedGroup.clientName}
                membersMap={membersMap}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/40 h-9 p-0.5 rounded-xl gap-0.5">
            <TabsTrigger value="clientes" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5" /> Clientes
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <Palette className="h-3.5 w-3.5" /> Layout PDF
            </TabsTrigger>
          </TabsList>

          {activeTab === "clientes" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-sm font-bold capitalize min-w-[140px] text-center">
                {format(cursor, "MMMM yyyy", { locale: ptBR })}
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="clientes" className="mt-4">
          {clientGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarRange className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-sm font-semibold mb-1">Nenhum cronograma neste mês</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Nenhuma postagem agendada para {format(cursor, "MMMM yyyy", { locale: ptBR })}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {clientGroups.map(g => (
                <div
                  key={g.clientId}
                  className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 group"
                  onClick={() => setSelectedClientId(g.clientId)}
                >
                  {/* Thumbnail */}
                  {g.thumbUrl ? (
                    <img src={g.thumbUrl} alt="" className="w-full aspect-square rounded-xl object-cover mb-3 group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-muted/30 flex items-center justify-center mb-3">
                      <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <h4 className="text-sm font-bold truncate">{g.clientName}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[9px] px-1.5">
                      {g.postCount} {g.postCount === 1 ? "postagem" : "postagens"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="layout" className="mt-4">
          <PdfLayoutEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
