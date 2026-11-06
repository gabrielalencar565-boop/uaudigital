import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CalendarPublication } from "../calendar-types";

// Publicação de postagem manual (etiqueta "Reels Teste"): vai para o Cronograma, mas quem posta é a equipe, à mão.
//  - "posted":  já marcada como postada (instagram_status = published, sem id do Instagram)
//  - "late":    passou o dia e ninguém marcou como postada nem agendou
//  - "waiting": ainda dentro do prazo (ou sem data)
//  - null:      não é manual, ou foi agendada normalmente (aí segue o fluxo de sempre)
export type ManualPostState = "posted" | "late" | "waiting" | null;

type Pub = Pick<CalendarPublication, "manual_post" | "instagram_status" | "instagram_scheduled" | "publish_date">;

/** `today` em yyyy-MM-dd. */
export function manualPostState(p: Pub, today: string): ManualPostState {
  if (!p.manual_post) return null;
  if (p.instagram_status === "published") return "posted";
  if (p.instagram_scheduled) return null;
  if (p.publish_date && p.publish_date < today) return "late";
  return "waiting";
}

/** Dias de atraso (mínimo 1) de uma publicação cuja data já passou. */
export function lateDays(publishDate: string, today: string): number {
  return Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(publishDate)));
}

export function lateLabel(days: number): string {
  return days === 1 ? "Atrasado 1 dia" : `Atrasado ${days} dias`;
}
