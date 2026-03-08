import { PropsWithChildren, useMemo, useState } from "react";
import {
  CalendarDays, ChevronDown, ChevronLeft, ClipboardList, DollarSign,
  Eye, FolderOpen, LayoutGrid, Settings, Target, TrendingUp, Trophy,
  UserRound, Workflow, CalendarRange, PieChart } from
"lucide-react";
import { useAppSettings } from "@/features/data/queries";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeSyncAll } from "@/hooks/use-realtime-sync";
import { TopBar } from "@/components/layout/TopBar";
import { EditProfileDialog } from "@/features/meu-painel/components/EditProfileDialog";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger } from
"@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger } from
"@/components/ui/collapsible";

export type MainTab =
"meu_painel" |
"visao_geral_projetos" |
"tarefas" |
"agenda_gestao" |
"cronograma" |
"fluxos" |
"visao_do_dia" |
"magic2" |
"desempenho" |
"financeiro" |
"metas" |
"configuracoes";

type NavGroup = {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  children: {key: MainTab;label: string;icon: React.ComponentType<any>;}[];
  adminOnly?: boolean;
  landingTab?: MainTab;
};

type NavSingle = {
  key: MainTab;
  label: string;
  icon: React.ComponentType<any>;
  adminOnly?: boolean;
};

type NavEntry = NavGroup | NavSingle;
function isGroup(e: NavEntry): e is NavGroup {return "children" in e;}

const NAV: NavEntry[] = [
{ key: "meu_painel", label: "Meu Painel", icon: UserRound },
{
  key: "gestao_group",
  label: "Projetos",
  icon: ClipboardList,
  landingTab: "visao_geral_projetos",
  children: [
  { key: "tarefas", label: "Tarefas", icon: LayoutGrid },
  { key: "agenda_gestao", label: "Agenda", icon: CalendarDays },
  { key: "cronograma", label: "Cronograma", icon: CalendarRange },
  { key: "fluxos", label: "Fluxos", icon: Workflow }]


},
{
  key: "dashboard_group",
  label: "Dashboard",
  icon: Eye,
  children: [
  { key: "visao_do_dia", label: "Visão do dia", icon: Eye },
  { key: "magic2", label: "Magic Number", icon: Target },
  { key: "desempenho", label: "Desempenho", icon: Trophy }]

},
{
  key: "financeiro_group",
  label: "Financeiro",
  icon: DollarSign,
  adminOnly: true,
  children: [
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "metas", label: "Metas", icon: TrendingUp }]

},
{ key: "configuracoes", label: "Configurações", icon: Settings, adminOnly: true }];


export function UauSidebarShell({
  children,
  tab,
  onTabChange,
  isAdmin




}: PropsWithChildren<{tab: MainTab;onTabChange: (t: MainTab) => void;isAdmin?: boolean;}>) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [notifTaskId, setNotifTaskId] = useState<string | null>(null);
  const appSettingsQ = useAppSettings();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";
  const logoClass = logoShape === "circle" ? "rounded-full" : "rounded-md";

  useRealtimeSyncAll();

  // Which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Open the group that contains the current tab by default
    const initial: Record<string, boolean> = {};
    NAV.forEach((e) => {
      if (isGroup(e)) {
        initial[e.key] = e.children.some((c) => c.key === tab);
      }
    });
    return initial;
  });

  const toggleGroup = (key: string) =>
  setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const filteredNav = useMemo(
    () => NAV.filter((e) => !e.adminOnly || isAdmin),
    [isAdmin]
  );

  const currentTabLabel = useMemo(() => {
    for (const e of NAV) {
      if (!isGroup(e) && e.key === tab) return e.label;
      if (isGroup(e)) {
        if (e.landingTab === tab) return e.label;
        const child = e.children.find((c) => c.key === tab);
        if (child) return child.label;
      }
    }
    return "Painel";
  }, [tab]);

  const isActive = (key: MainTab) => tab === key;

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-svh w-full bg-background text-foreground" style={{ willChange: "background" }}>
        <TopBar onEditProfile={() => setEditProfileOpen(true)} onOpenTask={(id) => setNotifTaskId(id)} />

        <Sidebar
          collapsible={isMobile ? "offcanvas" : "none"}
          className={cn(
            !isMobile &&
            "fixed left-0 top-[3.5rem] z-40 h-[calc(100svh-3.5rem)] border-r border-sidebar-border bg-sidebar",
            !isMobile && (collapsed ? "w-16" : "w-56 xl:w-64")
          )}>
          
          {/* Header: logo + collapse toggle */}
          <div className={cn("px-3 pb-1 pt-3", collapsed && !isMobile && "px-2")}>
            <div className={cn("flex items-center gap-2", collapsed && !isMobile && "justify-center")}>
              {logoUrl && (!collapsed || isMobile) ?
              <img src={logoUrl} alt="Logo" className={cn("h-7 w-7 object-cover", logoClass)} /> :
              null}
              {(!collapsed || isMobile) &&
              <span className="text-sm font-bold text-sidebar-foreground truncate">Uau Digital</span>
              }
              {!isMobile &&
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className={cn(
                  "ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                aria-label={collapsed ? "Expandir" : "Recolher"}>
                
                  <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
                </button>
              }
            </div>
          </div>

          <div className="mx-3 my-2 h-px bg-sidebar-foreground/15" />

          <SidebarContent className="px-2">
            <SidebarMenu>
              {filteredNav.map((entry) => {
                if (!isGroup(entry)) {
                  const active = isActive(entry.key);
                  return (
                    <SidebarMenuItem key={entry.key}>
                      <SidebarMenuButton
                        tooltip={entry.label}
                        isActive={active}
                        onClick={() => onTabChange(entry.key)}
                        className={cn(
                          "h-10 gap-3 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
                          active && "bg-sidebar-accent text-sidebar-foreground font-semibold",
                          collapsed && !isMobile && "justify-center"
                        )}>
                        
                        <entry.icon className="h-[18px] w-[18px] shrink-0" />
                        {(!collapsed || isMobile) && <span className="text-sm">{entry.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>);

                }

                // Group with children
                const groupOpen = !!openGroups[entry.key];
                const hasActiveChild = entry.children.some((c) => isActive(c.key)) || entry.landingTab && isActive(entry.landingTab);

                return (
                  <Collapsible key={entry.key} open={groupOpen} onOpenChange={() => toggleGroup(entry.key)}>
                    <SidebarMenuItem>
                      {/* Group header: click label area to navigate to landing, click chevron to toggle */}
                      <div className="flex items-center">
                        <SidebarMenuButton
                          tooltip={entry.label}
                          onClick={() => {
                            if (entry.landingTab) {
                              onTabChange(entry.landingTab);
                              if (!groupOpen) toggleGroup(entry.key);
                            } else {
                              toggleGroup(entry.key);
                            }
                          }}
                          className={cn(
                            "h-10 gap-3 rounded-xl text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors flex-1",
                            hasActiveChild && "bg-sidebar-accent text-sidebar-foreground font-semibold",
                            collapsed && !isMobile && "justify-center"
                          )}>
                          
                          <entry.icon className="h-[18px] w-[18px] shrink-0" />
                          {(!collapsed || isMobile) &&
                          <>
                              <span className="flex-1 text-sm">{entry.label}</span>
                            </>
                          }
                        </SidebarMenuButton>
                        {(!collapsed || isMobile) &&
                        <CollapsibleTrigger asChild>
                            <button
                            type="button"
                            className="inline-flex h-10 w-8 items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                            
                              <ChevronDown className={cn("h-4 w-4 transition-transform", groupOpen && "rotate-180")} />
                            </button>
                          </CollapsibleTrigger>
                        }
                      </div>

                      {(!collapsed || isMobile) &&
                      <CollapsibleContent>
                          <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-foreground/15 pl-3">
                            {entry.children.map((child) => {
                            const active = isActive(child.key);
                            return (
                              <button
                                key={child.key}
                                onClick={() => onTabChange(child.key)}
                                className={cn("flex w-full items-center gap-2.5 px-2.5 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-xl",

                                active && "bg-sidebar-accent text-sidebar-foreground font-medium"
                                )}>
                                
                                  <child.icon className="h-4 w-4 shrink-0" />
                                  <span>{child.label}</span>
                                </button>);

                          })}
                          </div>
                        </CollapsibleContent>
                      }
                    </SidebarMenuItem>
                  </Collapsible>);

              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            {logoUrl && (!collapsed || isMobile) ?
            <div className="flex items-center gap-2 px-3 pb-2">
                <img src={logoUrl} alt="Uau Digital" className={cn("h-6 w-6 object-cover", logoClass)} />
                <span className="text-[10px] text-sidebar-foreground/40">v1.0</span>
              </div> :
            null}
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          {isMobile &&
          <header className="sticky top-12 z-30 border-b border-border/60 bg-background/60 backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-3">
                <SidebarTrigger />
                <p className="truncate text-sm font-medium">{currentTabLabel}</p>
              </div>
            </header>
          }

          <div
            className={cn(
              "w-full pb-10 pt-14",
              isMobile ?
              "px-4" :
              collapsed ?
              "pl-[4rem] pr-4 pt-[4.5rem]" :
              "pl-[14rem] pr-4 pt-[4.5rem] xl:pl-[16rem] xl:pr-8"
            )}>
            
            <div className="mx-auto w-full 2xl:max-w-[1600px]">
              <div className="animate-fade-in overflow-x-auto p-4 sm:p-6 lg:p-8 2xl:p-10 px-[10px] py-[10px]">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>

        <EditProfileDialog open={editProfileOpen} onOpenChange={setEditProfileOpen} />
        <NotifTaskDialogWrapper taskId={notifTaskId} onClose={() => setNotifTaskId(null)} isAdmin={isAdmin ?? false} />
      </div>
    </SidebarProvider>);

}

function NotifTaskDialogWrapper({ taskId, onClose, isAdmin }: {taskId: string | null;onClose: () => void;isAdmin: boolean;}) {
  const pmTasksQ = usePmTasks();
  const task = useMemo(() => {
    if (!taskId) return null;
    return (pmTasksQ.data ?? []).find((t) => t.id === taskId) ?? null;
  }, [taskId, pmTasksQ.data]);

  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    }
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => {m[c.id] = c.name;});
    return m;
  }, [clientsQ.data]);

  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    }
  });
  const membersMap = useMemo(() => {
    const m: Record<string, {name: string;avatar?: string;}> = {};
    (membersQ.data ?? []).forEach((tm) => {m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };});
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  return (
    <PmTaskDetailDialog
      task={task}
      open={!!taskId}
      onClose={onClose}
      clientsMap={clientsMap}
      membersMap={membersMap}
      members={membersList}
      isAdmin={isAdmin} />);


}