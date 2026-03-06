import { useRef } from "react";
import { ChevronDown, LogOut, Moon, Palette, Pencil, Sun, Eye, Target, Trophy, ClipboardList, CalendarDays, DollarSign, TrendingUp, Shield } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useAppSettings } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { useQueryClient } from "@tanstack/react-query";
import type { MainTab } from "@/components/layout/UauSidebarShell";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface TopBarProps {
  onEditProfile?: () => void;
  onOpenTask?: (taskId: string) => void;
  onTabChange?: (tab: MainTab) => void;
  isAdmin?: boolean;
}

export function TopBar({ onEditProfile, onOpenTask, onTabChange, isAdmin }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const myProfileQ = useMyProfile();
  const appSettingsQ = useAppSettings();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = myProfileQ.data?.full_name ?? "Usuário";
  const userRole = myProfileQ.data?.role_title ?? "Colaborador";
  const userAvatar = myProfileQ.data?.avatar_url;
  const userInitials = initials(userName);

  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";

  const onLogout = async () => {
    await supabase.auth.signOut();
    toast.message("Até já — mantendo o ritmo!");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfileQ.data) return;

    const userId = myProfileQ.data.user_id;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${userId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("pm-attachments")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast.error("Erro ao enviar foto");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("pm-attachments")
      .getPublicUrl(path);

    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    // Update profiles table
    await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", userId);

    // Update team_members table
    await supabase
      .from("team_members")
      .update({ avatar_url: avatarUrl })
      .eq("user_id", userId);

    queryClient.invalidateQueries({ queryKey: ["my_profile"] });
    queryClient.invalidateQueries({ queryKey: ["team_members"] });
    toast.success("Foto atualizada!");

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo + workspace name + nav dropdown */}
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className={cn(
                "h-7 w-7 object-cover",
                logoShape === "circle" ? "rounded-full" : "rounded-md"
              )}
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <span className="text-xs font-bold text-primary">U</span>
            </div>
          )}
          <span className="text-sm font-semibold text-foreground hidden sm:inline-block">Uau Digital</span>

          {onTabChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-accent/50 focus:outline-none">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Área de Performance
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onTabChange("meu_painel")} className="gap-2.5 rounded-lg cursor-pointer">
                  <Eye className="h-4 w-4 text-muted-foreground" /> Meu Painel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTabChange("visao_do_dia")} className="gap-2.5 rounded-lg cursor-pointer">
                  <Eye className="h-4 w-4 text-muted-foreground" /> Visão do Dia
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTabChange("magic2")} className="gap-2.5 rounded-lg cursor-pointer">
                  <Target className="h-4 w-4 text-muted-foreground" /> Magic Number
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTabChange("desempenho")} className="gap-2.5 rounded-lg cursor-pointer">
                  <Trophy className="h-4 w-4 text-muted-foreground" /> Desempenho
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Área de Tarefas
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onTabChange("gestao")} className="gap-2.5 rounded-lg cursor-pointer">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" /> Gestão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTabChange("agenda")} className="gap-2.5 rounded-lg cursor-pointer">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" /> Agenda
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Área de Gestão
                    </DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onTabChange("financeiro")} className="gap-2.5 rounded-lg cursor-pointer">
                      <DollarSign className="h-4 w-4 text-muted-foreground" /> Financeiro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTabChange("metas")} className="gap-2.5 rounded-lg cursor-pointer">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" /> Metas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTabChange("admin")} className="gap-2.5 rounded-lg cursor-pointer">
                      <Shield className="h-4 w-4 text-muted-foreground" /> Admin
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-1.5">
          <NotificationsDropdown onOpenTask={onOpenTask} />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-accent/50 focus:outline-none">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={userAvatar ?? undefined} alt={userName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
              <div className="flex items-center gap-3 px-2 py-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={userAvatar ?? undefined} alt={userName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userRole}</p>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={onEditProfile}
                className="gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Editar perfil
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
              >
                <Palette className="h-4 w-4 text-muted-foreground" />
                Temas
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  {theme === "dark" ? (
                    <><Moon className="h-3 w-3" /> Escuro</>
                  ) : (
                    <><Sun className="h-3 w-3" /> Claro</>
                  )}
                </span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={onLogout}
                className="gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
