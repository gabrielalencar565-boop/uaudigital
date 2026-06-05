/**
 * Timeline-aware client status.
 * Mirrors the SQL function `public.client_status_at(uuid, int, int)`.
 *
 * Mantém histórico imutável: o status retornado depende exclusivamente
 * de qual mês está sendo consultado, nunca do "estado atual" do cliente.
 */
export type ClientTimelineStatus = "ativo" | "pausado" | "encerrado" | "fora_periodo" | "desconhecido";

export type ClientTimelineFields = {
  contract_start?: string | null;
  paused_from?: string | null;
  resumed_from?: string | null;
  ended_at?: string | null;
};

/** Trunca string ISO 'YYYY-MM-DD' (ou Date-like) ao 1º dia do mês como number (Date.UTC). */
function monthStart(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const s = typeof d === "string" ? d : d.toISOString();
  const [yStr, mStr] = s.slice(0, 10).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return null;
  return Date.UTC(y, m - 1, 1);
}

export function getClientStatusAt(
  client: ClientTimelineFields | null | undefined,
  year: number,
  month: number,
): ClientTimelineStatus {
  if (!client) return "desconhecido";
  const target = Date.UTC(year, month - 1, 1);

  const start = monthStart(client.contract_start);
  if (start !== null && target < start) return "fora_periodo";

  const ended = monthStart(client.ended_at);
  if (ended !== null && ended <= target) return "encerrado";

  const paused = monthStart(client.paused_from);
  if (paused !== null && paused <= target) {
    const resumed = monthStart(client.resumed_from);
    if (resumed === null || resumed > target) return "pausado";
  }

  return "ativo";
}

export function isClientActiveAt(client: ClientTimelineFields | null | undefined, year: number, month: number) {
  return getClientStatusAt(client, year, month) === "ativo";
}
