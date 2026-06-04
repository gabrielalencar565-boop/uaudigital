import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Control } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { Camera, Crop, ImagePlus, KeyRound, Save, UserRound } from "lucide-react";
import { AvatarCropDialog } from "./AvatarCropDialog";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function BirthDateSelects({ control }: { control: Control<ProfileValues> }) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 80 }, (_, i) => String(currentYear - i)), [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);

  // Keep partial selections in local state so user can fill one at a time
  const [localDay, setLocalDay] = useState("");
  const [localMonth, setLocalMonth] = useState("");
  const [localYear, setLocalYear] = useState("");
  const [initialized, setInitialized] = useState(false);

  return (
    <Controller
      control={control}
      name="birth_date"
      render={({ field }) => {
        // Sync from form value on first render
        if (!initialized && field.value) {
          const parts = field.value.split("-");
          if (parts.length === 3) {
            setLocalYear(parts[0]);
            setLocalMonth(String(Number(parts[1])));
            setLocalDay(String(Number(parts[2])));
          }
          setInitialized(true);
        } else if (!initialized) {
          setInitialized(true);
        }

        const syncToForm = (d: string, m: string, y: string) => {
          if (d && m && y) {
            field.onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
          }
        };

        const daysInMonth = localMonth && localYear
          ? new Date(Number(localYear), Number(localMonth), 0).getDate()
          : 31;
        const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

        // Clamp day if month changed
        const clampedDay = localDay && Number(localDay) > daysInMonth ? String(daysInMonth) : localDay;
        if (clampedDay !== localDay && localDay) {
          setLocalDay(clampedDay);
          syncToForm(clampedDay, localMonth, localYear);
        }

        return (
          <div className="space-y-2">
            <Label>Data de nascimento</Label>
            <div className="flex gap-2">
              <Select value={clampedDay} onValueChange={(v) => { setLocalDay(v); syncToForm(v, localMonth, localYear); }}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {days.map((day) => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localMonth} onValueChange={(v) => { setLocalMonth(v); syncToForm(localDay, v, localYear); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {months.map((mo, i) => (
                    <SelectItem key={mo} value={mo}>{MONTH_NAMES[i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={localYear} onValueChange={(v) => { setLocalYear(v); syncToForm(localDay, localMonth, v); }}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {years.map((yr) => (
                    <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }}
    />
  );
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar senha");
    } finally {
      setChangingPassword(false);
    }
  };

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
      setAvatarBlob(null);
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
            <div className="flex items-center gap-4">
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="relative group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={avatarPreview ?? avatarUrl ?? undefined} alt="Foto do perfil" />
                      <AvatarFallback>{initials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => { setPopoverOpen(false); fileInputRef.current?.click(); }}
                  >
                    <ImagePlus className="h-4 w-4" /> Alterar foto
                  </button>
                  {(avatarPreview || avatarUrl) && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setPopoverOpen(false); setCropSrc(avatarPreview ?? avatarUrl!); }}
                    >
                      <Crop className="h-4 w-4" /> Ajustar foto
                    </button>
                  )}
                </PopoverContent>
              </Popover>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Clique na foto para opções</p>
                <p className="text-xs text-muted-foreground">PNG/JPG/WebP • até 5MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>

          <AvatarCropDialog
            open={!!cropSrc}
            imageSrc={cropSrc ?? ""}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />

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

          <BirthDateSelects control={form.control} />

          <div className="space-y-3 rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Segurança</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">Nova senha</Label>
              <Input
                id="new_password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirmar nova senha</Label>
              <Input
                id="confirm_password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={changingPassword || !newPassword || !confirmPassword}
              onClick={handleChangePassword}
            >
              <KeyRound className="h-4 w-4" />
              {changingPassword ? "Alterando..." : "Alterar senha"}
            </Button>
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
