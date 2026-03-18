import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PdfSettings } from "./types";

const sb = supabase as any;

export function usePdfSettings() {
  return useQuery<PdfSettings>({
    queryKey: ["pm_pdf_settings"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_pdf_settings").select("*").limit(1).single();
      if (error) throw error;
      return {
        ...data,
        blocks_order: data.blocks_order ?? ["cover", "cards", "carousel", "footer"],
        blocks_enabled: data.blocks_enabled ?? { cover: true, cards: true, carousel: true, footer: true },
        layout_overrides: data.layout_overrides ?? {},
        footer_title_font_size: data.footer_title_font_size ?? 32,
        footer_subtitle_font_size: data.footer_subtitle_font_size ?? 18,
        footer_contact_font_size: data.footer_contact_font_size ?? 11,
        card_image_width_pct: data.card_image_width_pct ?? 45,
        carousel_cols: data.carousel_cols ?? 4,
        carousel_rows: data.carousel_rows ?? 2,
        carousel_title_font_size: data.carousel_title_font_size ?? 14,
        carousel_caption_font_size: data.carousel_caption_font_size ?? 11,
        carousel_date_font_size: data.carousel_date_font_size ?? 12,
        carousel_image_height_pct: data.carousel_image_height_pct ?? 65,
      };
    },
  });
}

export function useUpdatePdfSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<PdfSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await sb
        .from("pm_pdf_settings")
        .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_pdf_settings"] });
      toast.success("Layout salvo!");
    },
  });
}

export async function uploadPdfAsset(file: File, prefix: string) {
  const path = `pdf-layouts/${prefix}-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
  return data.publicUrl;
}
