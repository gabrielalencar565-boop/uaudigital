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

    </>
  );
}
