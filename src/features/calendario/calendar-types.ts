import type { Database } from "@/integrations/supabase/types";

export type CalendarStatus = Database["public"]["Enums"]["calendar_status"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status"];
export type PublicationContentType = Database["public"]["Enums"]["publication_content_type"];

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
  order_index: number;
  created_at: string;
  updated_at: string;
}

export const CALENDAR_STATUS_LABELS: Record<CalendarStatus, string> = {
  em_montagem: "Em montagem",
  em_revisao_interna: "Em revisão interna",
  pronto_para_envio: "Pronto para envio",
  enviado_ao_cliente: "Enviado ao cliente",
  alteracoes_solicitadas: "Alterações solicitadas",
  aprovado: "Aprovado",
  arquivado: "Arquivado",
};

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  alteracao_solicitada: "Alteração solicitada",
  atualizada: "Atualizada",
  cancelada: "Cancelada",
};

export const CONTENT_TYPE_LABELS: Record<PublicationContentType, string> = {
  imagem: "Imagem",
  carrossel: "Carrossel",
  reel: "Reel",
  video: "Vídeo",
  story: "Story",
  outro: "Outro",
};
