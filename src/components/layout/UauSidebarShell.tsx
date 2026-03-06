import { PropsWithChildren, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Eye,
  Palette,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import { useAppSettings } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeSyncAll } from "@/hooks/use-realtime-sync";
import { TopBar } from "@/components/layout/TopBar";
import { EditProfileDialog } from "@/features/meu-painel/components/EditProfileDialog";
import { useQuery } from "@tanstack/react-query";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type MainTab =
  | "meu_painel"
  | "criacao"
  | "visao_do_dia"
  | "magic2"
  | "desempenho"
  | "admin"
  | "financeiro"
  | "metas";

type NavItem = {
  key: MainTab;
  label: string;
  icon: React.ComponentType<any>;
};

type NavGroup = {
  key: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

export function UauSidebarShell({
  children,
  tab,
  onTabChange,
  isAdmin,
}: PropsWithChildren<{
  tab: MainTab;
  onTabChange: (t: MainTab) => void;
  isAdmin?: boolean;
}>) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [notifTaskId, setNotifTaskId] = useState<string | null>(null);
  const appSettingsQ = useAppSettings();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";
  const logoClass = logoShape === "circle" ? "rounded-full" : "rounded-md";

  useRealtimeSyncAll();

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    tarefas: true,
    performance: true,
    gestao: true,
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const navGroups = useMemo<NavGroup[]>(() => {
    const groups: NavGroup[] = [
      {
        key: "tarefas",
        label: "Tarefas",
        items: [
          { key: "criacao", label: "Criação", icon: Palette },
        ],
      },
      {
        key: "performance",
        label: "Performance",
        items: [
          { key: "visao_do_dia", label: "Visão do dia", icon: Eye },
          { key: "magic2", label: "Magic Number", icon: Target },
          { key: "desempenho", label: "Desempenho", icon: Trophy },
        ],
      },
    ];

    if (isAdmin) {
      groups.push({
        key: "gestao",
        label: "Gestão",
        adminOnly: true,
        items: [
          { key: "financeiro", label: "Financeiro", icon: DollarSign },
          { key: "metas", label: "Metas", icon: TrendingUp },
          { key: "admin", label: "Admin", icon: Shield },
        ],
      });
    }

    return groups;
  }, [isAdmin]);

  const allItems = useMemo(
    () => [
      { key: "meu_painel" as MainTab, label: "Meu Painel" },
      ...navGroups.flatMap((g) => g.items),
    ],
    [navGroups],
  );

  const currentTabLabel = useMemo(
    () => allItems.find((i) => i.key === tab)?.label ?? "Painel",
    [allItems, tab],
  );

  return (
    <SidebarProvider defaultOpen>
      <div
        className="min-h-svh w-full bg-background text-foreground"
        style={{ willChange: "background" }}
      >
        <TopBar
          onEditProfile={() => setEditProfileOpen(true)}
          onOpenTask={(id) => setNotifTaskId(id)}
        />

        <Sidebar
          collapsible={isMobile ? "offcanvas" : "none"}
          className={cn(
            !isMobile &&
              "fixed left-3 top-[3.5rem] z-40 h-[calc(100svh-4rem)] rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md",
            !isMobile && (collapsed ? "w-16" : "w-56 xl:w-64"),
          )}
        >
          <div className={cn("px-3 pb-2 pt-3", collapsed && !isMobile && "px-2")}>
            <div className={cn("flex items-center gap-2", collapsed && !isMobile && "justify-center")}>
              {!isMobile ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((v) => !v)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground transition",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  aria-label={collapsed ? "Expandir" : "Recolher"}
                >
                  <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
                </button>
              ) : null}
            </div>
          </div>

          <SidebarContent>
            {/* Meu Painel – standalone at top */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Meu Painel"
                      isActive={tab === "meu_painel"}
                      onClick={() => onTabChange("meu_painel")}
                      className={cn(collapsed && !isMobile && "justify-center")}
                    >
                      <UserRound />
                      {!collapsed || isMobile ? <span>Meu Painel</span> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Collapsible groups */}
            {navGroups.map((group) => {
              const isGroupActive = group.items.some((it) => it.key === tab);
              const isOpen = openGroups[group.key] ?? true;

              return (
                <SidebarGroup key={group.key}>
                  {!collapsed || isMobile ? (
                    <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.key)}>
                      <CollapsibleTrigger asChild>
                        <SidebarGroupLabel className="cursor-pointer select-none hover:text-sidebar-foreground transition-colors">
                          <span>{group.label}</span>
                          <ChevronRight
                            className={cn(
                              "ml-auto h-3.5 w-3.5 transition-transform duration-200",
                              isOpen && "rotate-90",
                            )}
                          />
                        </SidebarGroupLabel>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {group.items.map((it) => (
                              <SidebarMenuItem key={it.key}>
                                <SidebarMenuButton
                                  tooltip={it.label}
                                  isActive={tab === it.key}
                                  onClick={() => onTabChange(it.key)}
                                >
                                  <it.icon />
                                  <span>{it.label}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    /* Collapsed: show only icons */
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((it) => (
                          <SidebarMenuItem key={it.key}>
                            <SidebarMenuButton
                              tooltip={it.label}
                              isActive={tab === it.key}
                              onClick={() => onTabChange(it.key)}
                              className="justify-center"
                            >
                              <it.icon />
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              );
            })}
          </SidebarContent>

          <SidebarFooter>
            {logoUrl && (!collapsed || isMobile) ? (
              <div className="flex items-center gap-2 px-3 pb-2">
                <img src={logoUrl} alt="Uau Digital" className={cn("h-6 w-6 object-cover", logoClass)} />
                <span className="text-[10px] text-sidebar-foreground/50">v1.0</span>
              </div>
            ) : null}
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          {isMobile ? (
            <header className="sticky top-12 z-30 border-b border-border/60 bg-background/60 backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-3">
                <SidebarTrigger />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{currentTabLabel}</p>
                </div>
              </div>
            </header>
          ) : null}

          <div
            className={cn(
              "w-full pb-10 pt-14",
              isMobile
                ? "px-4"
                : collapsed
                  ? "pl-[calc(4rem+theme(spacing.3)+theme(spacing.3))] pr-4 pt-[4.5rem]"
                  : "pl-[calc(14rem+theme(spacing.6)+theme(spacing.3))] pr-4 pt-[4.5rem] xl:pl-[calc(16rem+theme(spacing.6)+theme(spacing.3))] xl:pr-8",
            )}
          >
            <div className="mx-auto w-full 2xl:max-w-[1600px]">
              <div className="uau-surface overflow-x-auto rounded-xl border border-border/60 p-4 sm:p-6 lg:p-8 2xl:p-10">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>

        <EditProfileDialog open={editProfileOpen} onOpenChange={setEditProfileOpen} />

        <NotifTaskDialogWrapper
          taskId={notifTaskId}
          onClose={() => setNotifTaskId(null)}
          isAdmin={isAdmin ?? false}
        />
      </div>
    </SidebarProvider>
  );
}

function NotifTaskDialogWrapper({
  taskId,
  onClose,
  isAdmin,
}: {
  taskId: string | null;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const pmTasksQ = usePmTasks();
  const task = useMemo(() => {
    if (!taskId) return null;
    return (pmTasksQ.data ?? []).find((t) => t.id === taskId) ?? null;
  }, [taskId, pmTasksQ.data]);

  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => {
      m[c.id] = c.name;
    });
    return m;
  }, [clientsQ.data]);

  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, display_name, avatar_url")
        .eq("is_active", true);
      return data ?? [];
    },
  });
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach((tm) => {
      m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };
    });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(
    () => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })),
    [membersQ.data],
  );

  return (
    <PmTaskDetailDialog
      task={task}
      open={!!taskId}
      onClose={onClose}
      clientsMap={clientsMap}
      membersMap={membersMap}
      members={membersList}
      isAdmin={isAdmin}
    />
  );
}
