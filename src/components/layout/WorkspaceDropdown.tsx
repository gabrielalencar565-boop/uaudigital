import { useMemo, useRef, useState } from "react";
import { ChevronDown, Settings, Users, Camera, Pencil, Save, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type View = "main" | "config" | "pessoas";

export function WorkspaceDropdown() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const appSettingsQ = useAppSettings();
  const updateAppSettings = useUpdateAppSettings();
  const queryClient = useQueryClient();
  const logoUrl = appSettingsQ.data?.logo_url;
  const logoShape = appSettingsQ.data?.logo_shape ?? "square";

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");

  // Members count
  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id, display_name, avatar_url, role_title, is_active")
        .eq("is_active", true)
        .order("display_name");
      return data ?? [];
    },
  });
  const membersCount = membersQ.data?.length ?? 0;

  // Config state
  const [workspaceName, setWorkspaceName] = useState("Uau Digital");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("Uau Digital");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/svg+xml"];
      if (!validTypes.includes(file.type)) throw new Error("Formato inválido. Use PNG, JPEG, WebP, GIF ou SVG.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Máx 5MB");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `logo_${Date.now()}.${ext}`;
      const up = await supabase.storage.from("app-assets").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("app-assets").getPublicUrl(path);
      const newUrl = pub.data.publicUrl;

      // Try update first, if no row exists then insert
      const { data: updated, error: updateErr } = await supabase
        .from("app_settings")
        .update({ logo_url: newUrl })
        .eq("id", 1)
        .select();

      if (updateErr) throw updateErr;

      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase
          .from("app_settings")
          .insert({ id: 1, logo_url: newUrl });
        if (insertErr) throw insertErr;
      }

      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Logo atualizada!");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleBack = () => setView("main");

  return (
    <>
      <button
        onClick={() => logoInputRef.current?.click()}
        disabled={uploadingLogo}
        className="relative group flex items-center rounded-xl transition hover:opacity-80 focus:outline-none"
        title="Alterar logo da empresa"
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className={cn(
              "h-8 w-8 object-cover",
              logoShape === "circle" ? "rounded-full" : "rounded-xl"
            )}
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Camera className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition">
          <Camera className="h-3.5 w-3.5 text-white" />
        </div>
      </button>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
      />

      <PopoverContent align="start" className="w-80 rounded-xl p-0" sideOffset={8}>
        {view === "main" && (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 p-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className={cn(
                    "h-10 w-10 object-cover",
                    logoShape === "circle" ? "rounded-full" : "rounded-lg"
                  )}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <span className="text-sm font-bold text-primary">U</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {workspaceName} - Espaço
                </p>
                <p className="text-xs text-muted-foreground">
                  {membersCount} {membersCount === 1 ? "membro" : "membros"}
                </p>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="p-2 flex gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 justify-start rounded-lg"
                  onClick={() => setView("config")}
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-2 justify-start rounded-lg"
                onClick={() => setView("pessoas")}
              >
                <Users className="h-4 w-4" />
                Pessoas
              </Button>
            </div>
          </div>
        )}

        {view === "config" && (
          <div>
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <span className="text-sm font-semibold">Configurações do Espaço</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Foto do espaço</Label>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className={cn(
                          "h-14 w-14 object-cover border border-border",
                          logoShape === "circle" ? "rounded-full" : "rounded-lg"
                        )}
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 border border-border">
                        <span className="text-lg font-bold text-primary">U</span>
                      </div>
                    )}
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Camera className="h-5 w-5 text-white" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="text-xs"
                    >
                      {uploadingLogo ? "Enviando..." : "Alterar foto"}
                    </Button>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>

              {/* Rename */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome do espaço</Label>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (tempName.trim()) setWorkspaceName(tempName.trim());
                        setEditingName(false);
                      }}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => { setTempName(workspaceName); setEditingName(false); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setTempName(workspaceName); setEditingName(true); }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground hover:bg-accent/30 transition"
                  >
                    <span className="flex-1 text-left">{workspaceName}</span>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "pessoas" && (
          <div>
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition">
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <span className="text-sm font-semibold">Pessoas</span>
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {membersCount}
              </Badge>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {(membersQ.data ?? []).map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/30 transition"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {m.display_name?.split(" ").slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join("") ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.display_name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {m.role_title}
                    </p>
                  </div>
                </div>
              ))}

              {membersQ.isLoading && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">Carregando...</p>
              )}
              {!membersQ.isLoading && membersCount === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum membro encontrado</p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
