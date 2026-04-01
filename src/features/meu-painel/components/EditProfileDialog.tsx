import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Camera, Save, UserRound } from "lucide-react";
import { AvatarCropDialog } from "./AvatarCropDialog";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_OPTIONS } from "@/lib/role-options";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(120),
  role_title: z.string().trim().min(2, "Informe seu cargo").max(120),
  birth_date: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function EditProfileDialog({ open, onOpenChange, onSaved }: EditProfileDialogProps) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", role_title: "", birth_date: "" },
  });

  // Load current profile when dialog opens
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, role_title, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        supabase
          .from("team_members")
          .select("birth_date")
          .eq("user_id", user.id)
          .maybeSingle()
          .then(({ data: tmData }) => {
            if (cancelled) return;
            if (data) {
              form.reset({
                full_name: data.full_name ?? "",
                role_title: data.role_title ?? "",
                birth_date: (tmData as any)?.birth_date ?? "",
              });
              setAvatarUrl(data.avatar_url ?? null);
            }
          });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleCropConfirm = useCallback((blob: Blob) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    const url = URL.createObjectURL(blob);
    setAvatarPreview(url);
    setAvatarBlob(blob);
    setCropSrc(null);
  }, [avatarPreview, cropSrc]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const displayName = useMemo(() => form.watch("full_name") || "?", [form]);

  const onSave = async (v: ProfileValues) => {
    if (!user) return;
    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarBlob) {
        if (avatarBlob.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx 5MB)");

        const path = `${user.id}/${crypto.randomUUID()}.webp`;
        const up = await supabase.storage.from("avatars").upload(path, avatarBlob, {
          upsert: true,
          contentType: "image/webp",
        });
        if (up.error) throw up.error;
        const pub = supabase.storage.from("avatars").getPublicUrl(path);
        nextAvatarUrl = pub.data.publicUrl ?? null;
      }

      const prof = await supabase
        .from("profiles")
        .update({ full_name: v.full_name, role_title: v.role_title, avatar_url: nextAvatarUrl })
        .eq("user_id", user.id);
      if (prof.error) throw prof.error;

      const tm = await supabase
        .from("team_members")
        .upsert(
          {
            user_id: user.id,
            display_name: v.full_name,
            role_title: v.role_title,
            avatar_url: nextAvatarUrl,
            is_active: true,
            birth_date: v.birth_date || null,
          } as any,
          { onConflict: "user_id" },
        );
      if (tm.error) throw tm.error;

      setAvatarUrl(nextAvatarUrl);
      setAvatarFile(null);
      // Invalidar todos os caches que consomem dados de avatar
      queryClient.invalidateQueries({ queryKey: ["my_profile"] });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Perfil atualizado!");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" /> Editar perfil
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-2">
            <Label>Foto</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarPreview ?? avatarUrl ?? undefined} alt="Foto do perfil" />
                <AvatarFallback>{initials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">PNG/JPG/WebP • até 5MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_full_name">Nome</Label>
            <Input id="edit_full_name" placeholder="Seu nome" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_role_title">Cargo</Label>
            <Controller
              control={form.control}
              name="role_title"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit_role_title">
                    <SelectValue placeholder="Selecione seu cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.role_title && (
              <p className="text-sm text-destructive">{form.formState.errors.role_title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_birth_date">Data de nascimento</Label>
            <DatePicker value={form.watch("birth_date") ?? ""} onChange={(v) => form.setValue("birth_date", v)} className="w-full" />
            
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
