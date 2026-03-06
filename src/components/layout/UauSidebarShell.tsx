import { PropsWithChildren, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ClipboardList, DollarSign, Eye, LogOut, Shield, Target, TrendingUp, Trophy, UserRound } from "lucide-react";
import { useAppSettings } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeSyncAll } from "@/hooks/use-realtime-sync";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export type MainTab = "visao_do_dia" | "meu_painel" | "desempenho" | "magic2" | "agenda" | "gestao" | "admin" | "financeiro" | "metas";

type NavItem = {
  key: MainTab;
  label: string;
  icon: React.ComponentType<any>;
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
  const appSettingsQ = useAppSettings();
  const myProfileQ = useMyProfile();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";
  const logoClass = logoShape === "circle" ? "rounded-full" : "rounded-md";

  useRealtimeSyncAll();

  const navItems = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      { key: "meu_painel", label: "Meu Painel", icon: UserRound },
      { key: "visao_do_dia", label: "Visão do dia", icon: Eye },
      { key: "magic2", label: "Magic Number", icon: Target },
      { key: "agenda", label: "Agenda", icon: CalendarDays },
      { key: "gestao", label: "Gestão", icon: ClipboardList },
      { key: "desempenho", label: "Desempenho", icon: Trophy },
    ];

    if (isAdmin) {
      base.push({ key: "financeiro", label: "Financeiro", icon: DollarSign });
      base.push({ key: "metas", label: "Metas", icon: TrendingUp });
      base.push({ key: "admin", label: "Admin", icon: Shield });
    }
    return base;
  }, [isAdmin]);

  const currentTabLabel = useMemo(() => navItems.find((i) => i.key === tab)?.label ?? "Painel", [navItems, tab]);

  return (
    <SidebarProvider defaultOpen>
      <div
        className="min-h-svh w-full bg-background text-foreground"
        style={{ willChange: "background" }}
      >
        {/* Fixed top bar */}
        <TopBar onEditProfile={() => setEditProfileOpen(true)} />

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
              {/* Desktop: collapse toggle */}
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
            <SidebarGroup>
              {!collapsed || isMobile ? <SidebarGroupLabel>Painel</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((it) => (
                    <SidebarMenuItem key={it.key}>
                      <SidebarMenuButton
                        tooltip={it.label}
                        isActive={tab === it.key}
                        onClick={() => onTabChange(it.key)}
                        className={cn(collapsed && !isMobile && "justify-center")}
                      >
                        <it.icon />
                        {!collapsed || isMobile ? <span>{it.label}</span> : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
          {/* Mobile topbar (com hamburger) */}
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

        <EditProfileDialog
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
        />
      </div>
    </SidebarProvider>
  );
}
