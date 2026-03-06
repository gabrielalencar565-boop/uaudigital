import { useState } from "react";
import { Bell, ChevronDown, LogOut, Moon, Palette, Pencil, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useAppSettings } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface TopBarProps {
  onEditProfile?: () => void;
}

export function TopBar({ onEditProfile }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const myProfileQ = useMyProfile();
  const appSettingsQ = useAppSettings();

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo + workspace name */}
        <div className="flex items-center gap-2.5">
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
          <span className="text-sm font-semibold text-foreground">Uau Digital</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-1.5">
          {/* Notifications */}
          <NotificationsDropdown />

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
              {/* Profile header */}
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
