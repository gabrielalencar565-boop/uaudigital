import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarPublication } from "../calendar-types";
import type { ProfileDraft, ProfileRow } from "../lib/profile-month";

const sb = supabase as any;
const PREVIOUS_LIMIT = 24;
const MAX_IMAGE_MB = 15;
const MAX_SIDE = 1080;

export function useProfileMonths(clientId: string) {
  return useQuery({
    queryKey: ["client_profile_months", clientId],
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await sb
        .from("client_profile_months")
        .select("id, month, photo_url, display_name, highlights, pinned_publication_ids")
        .eq("client_id", clientId)
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveProfileMonth(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ savedId, month, draft }: { savedId: string | null; month: string; draft: ProfileDraft }): Promise<string> => {
      const values = {
        photo_url: draft.photo_url,
        display_name: draft.display_name.trim() || null,
        highlights: draft.highlights,
        pinned_publication_ids: draft.pinned_publication_ids,
      };
      // update e insert separados (sem upsert): quem só pode alterar não precisa da permissão de criar
      const query = savedId
        ? sb.from("client_profile_months").update(values).eq("id", savedId)
        : sb.from("client_profile_months").insert({ ...values, client_id: clientId, month });
      const { data, error } = await query.select("id");
      if (error?.code === "23505") throw new Error("Outra pessoa acabou de salvar este mês. Feche e abra o Estúdio para ver.");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para salvar este perfil.");
      return data[0].id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_profile_months", clientId] }),
  });
}

/** Posts anteriores ao ciclo (para a grade ficar completa), mais os fixados que forem mais antigos que isso. */
export function usePreviousFeedPublications(calendarIds: string[], before: string, pinnedIds: string[]) {
  return useQuery({
    enabled: calendarIds.length > 0,
    queryKey: ["profile_previous_publications", calendarIds, before, pinnedIds],
    placeholderData: (previous: CalendarPublication[] | undefined) => previous,
    queryFn: async (): Promise<CalendarPublication[]> => {
      const base = () => sb.from("calendar_publications").select("*").in("calendar_id", calendarIds).is("deleted_at", null).neq("content_type", "story");
      const older = await base().lt("publish_date", before).order("publish_date", { ascending: false }).order("publish_time", { ascending: false }).limit(PREVIOUS_LIMIT);
      if (older.error) throw older.error;
      const list: CalendarPublication[] = older.data ?? [];
      const missing = pinnedIds.filter((id) => !list.some((p) => p.id === id));
      if (missing.length === 0) return list;
      const extra = await base().in("id", missing);
      if (extra.error) throw extra.error;
      return [...list, ...(extra.data ?? [])];
    },
  });
}

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Não consegui ler essa imagem. Envie um JPG ou PNG.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff"; // PNG com fundo transparente não pode virar preto no JPEG
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não consegui preparar a imagem."))), "image/jpeg", 0.88));
}

/** Foto do perfil e capas dos destaques. Vão para o armazenamento dos anexos, na pasta de quem enviou (é onde a equipe pode enviar). */
export async function uploadProfileImage(clientId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem.");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`A imagem passa de ${MAX_IMAGE_MB} MB.`);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sua sessão expirou. Entre de novo.");
  const blob = await toJpeg(file);
  const path = `${auth.user.id}/client-profiles/${clientId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("pm-attachments").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("pm-attachments").getPublicUrl(path).data.publicUrl;
}
