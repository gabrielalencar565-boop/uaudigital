import type { Database } from "@/integrations/supabase/types";

export type CalendarStatus = Database["public"]["Enums"]["calendar_status"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status"];
export type PublicationContentType = Database["public"]["Enums"]["publication_content_type"];

// Formatos que ocupam o feed do Instagram no formato retrato padrão (1080x1350) — usado
// pra saber quando ajustar a foto automaticamente nesse tamanho ao anexar. Stories e Reels
// têm proporções diferentes (9:16) e ficam de fora de propósito.
export const FEED_ASPECT_CONTENT_TYPES: PublicationContentType[] = ["carrossel", "post", "foto"];

// Tamanhos padrão do Instagram: Carrossel/Post/Foto no feed retrato 1080x1350 (4:5); Reels e Stories em tela cheia
// 1080x1920 (9:16). Toda imagem anexada é recortada nesse tamanho e a prévia sempre mostra o enquadramento final.
export interface InstagramFormat {
  aspect: number; // largura / altura
  width: number;
  height: number;
  label: string;
}
export const FEED_FORMAT: InstagramFormat = { aspect: 4 / 5, width: 1080, height: 1350, label: "feed (1080x1350)" };
export const VERTICAL_FORMAT: InstagramFormat = { aspect: 9 / 16, width: 1080, height: 1920, label: "Stories e Reels (1080x1920)" };

export function getInstagramFormat(contentType: PublicationContentType | null | undefined): InstagramFormat | null {
  if (!contentType) return null;
  if (FEED_ASPECT_CONTENT_TYPES.includes(contentType)) return FEED_FORMAT;
  // "video" é um tipo legado — todo vídeo é Reels hoje
  if (contentType === "story" || contentType === "reel" || contentType === "video") return VERTICAL_FORMAT;
  return null; // "outro": sem formato (e sem publicação automática)
}

export interface PublicationCalendar {
  id: string;
  client_id: string;
  cycle_start: string;
  cycle_end: string;
  status: CalendarStatus;
  share_token: string;
  share_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarPublication {
  id: string;
  calendar_id: string;
  task_id: string;
  title: string;
  content_type: PublicationContentType;
  caption: string | null;
  publish_date: string | null;
  publish_time: string | null;
  status: PublicationStatus;
  internal_note: string | null;
  client_note: string | null;
  client_feedback: string | null;
  client_responded_at: string | null;
  cover_attachment_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  instagram_status: "not_published" | "pending" | "publishing" | "published" | "failed";
  // Team explicitly confirmed this is cleared for the auto-publish cron to pick up — set via
  // the per-publication "Agendar" action or the cycle-wide "Agendar publicações" bulk action.
  instagram_scheduled: boolean;
  instagram_media_id: string | null;
  instagram_creation_id: string | null;
  instagram_permalink: string | null;
  instagram_error: string | null;
  instagram_published_at: string | null;
  instagram_publish_attempted_at: string | null;
}

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  em_montagem: "Em montagem",
  enviado_ao_cliente: "Enviado ao cliente",
  alteracoes_solicitadas: "Alterações solicitadas",
  aprovado: "Aprovado",
};

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  em_montagem: "Em montagem",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  alteracao_solicitada: "Alteração solicitada",
};

export const CONTENT_TYPE_LABELS: Record<PublicationContentType, string> = {
  carrossel: "Carrossel",
  reel: "Reels",
  video: "Vídeo",
  story: "Stories",
  outro: "Outro",
  post: "Post",
  foto: "Foto",
};
