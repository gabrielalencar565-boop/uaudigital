import { useRef, useState, useEffect } from "react";
import { LogOut, Moon, Pencil, Sun, Volume2 } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useAppSettings } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { TaskSearchDropdown } from "@/components/layout/TaskSearchDropdown";
import { ChatBellButton } from "@/features/chat/ChatBellButton";

import { useQueryClient } from "@tanstack/react-query";
import { NotificationSoundsDialog } from "@/features/configuracoes/NotificationSoundsDialog";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface TopBarProps {
  onEditProfile?: () => void;
  onOpenTask?: (taskId: string) => void;
}

export function TopBar({ onEditProfile, onOpenTask }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const myProfileQ = useMyProfile();
  const appSettingsQ = useAppSettings();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);

  const userName = myProfileQ.data?.full_name ?? "Usuário";
  const userRole = myProfileQ.data?.role_title ?? "Colaborador";
  const userAvatar = myProfileQ.data?.avatar_url;
  const userInitials = initials(userName);

  const onLogout = async () => {
    await supabase.auth.signOut();
    toast.message("Até já — mantendo o ritmo!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !myProfileQ.data) return;

    const userId = myProfileQ.data.user_id;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      toast.error("Erro ao enviar foto");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const avatarUrl = urlData.publicUrl;

    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
    await supabase.from("team_members").update({ avatar_url: avatarUrl }).eq("user_id", userId);

    queryClient.invalidateQueries({ queryKey: ["my_profile"] });
    queryClient.invalidateQueries({ queryKey: ["team_members"] });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    toast.success("Foto atualizada!");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    // No background/border spanning the full width on purpose — the sidebar now floats up
    // into this same top strip, and a full-width bar here would paint a translucent stripe
    // over its rounded top corner. Only the icon cluster itself (bottom div) gets a visible
    // background, sized to its own content and floated top-right, so it never overlaps the
    // sidebar's column at all.
    <header className="fixed top-0 left-0 right-0 z-50 h-16">
      <div className="flex h-full items-center justify-end px-4">
        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-border/40 bg-background/80 px-2 py-1.5 shadow-lg backdrop-blur-md">
          <ChatBellButton />
          <TaskSearchDropdown onSelectTask={(id) => onOpenTask?.(id)} />
          <NotificationsDropdown onOpenTask={onOpenTask} />

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-accent/50 focus:outline-none"
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-accent/50 focus:outline-none">
                <Avatar className="h-7 w-7 ring-2 ring-[#6932c9] ring-offset-2 ring-offset-background">
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
                onSelect={(e) => {
                  e.preventDefault();
                  setSoundsOpen(true);
                }}
                className="gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
              >
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                Som de notificações
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
      <NotificationSoundsDialog open={soundsOpen} onOpenChange={setSoundsOpen} />
    </header>

  );
}
