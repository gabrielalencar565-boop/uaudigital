import "server-only";
import { contarGeracoes, supabaseConfigurado } from "./supabase";

export const LIMITE_POR_WHATSAPP = 3;
export const LIMITE_POR_IP = 10;

/** Início do dia de hoje no horário de Brasília (UTC-3, sem horário de verão). */
export function inicioDoDiaBrasilia(agora = new Date()): Date {
  const brt = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0));
}

/* Sem Supabase: contagem em memória (vale por instância do servidor; é só um freio). */
const memoria = new Map<string, number>();
function chaveMemoria(tipo: string, valor: string) {
  return `${inicioDoDiaBrasilia().toISOString()}|${tipo}|${valor}`;
}

export async function dentroDoLimite(whatsapp: string, ip: string | null): Promise<boolean> {
  if (!supabaseConfigurado()) {
    const porWhats = memoria.get(chaveMemoria("w", whatsapp)) ?? 0;
    const porIp = ip ? (memoria.get(chaveMemoria("i", ip)) ?? 0) : 0;
    return porWhats < LIMITE_POR_WHATSAPP && porIp < LIMITE_POR_IP;
  }
  try {
    const desde = inicioDoDiaBrasilia();
    const [porWhats, porIp] = await Promise.all([
      contarGeracoes(`whatsapp=eq.${encodeURIComponent(whatsapp)}`, desde),
      ip ? contarGeracoes(`ip=eq.${encodeURIComponent(ip)}`, desde) : Promise.resolve(0),
    ]);
    return porWhats < LIMITE_POR_WHATSAPP && porIp < LIMITE_POR_IP;
  } catch (erro) {
    // Se a contagem falhar, não trava a pessoa.
    console.error("[planejamento] Falha ao checar limite:", erro);
    return true;
  }
}

export function registrarNaMemoria(whatsapp: string, ip: string | null) {
  if (supabaseConfigurado()) return;
  const w = chaveMemoria("w", whatsapp);
  memoria.set(w, (memoria.get(w) ?? 0) + 1);
  if (ip) {
    const i = chaveMemoria("i", ip);
    memoria.set(i, (memoria.get(i) ?? 0) + 1);
  }
}

export function ipDaRequisicao(request: Request): string | null {
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || request.headers.get("x-real-ip") || null;
}
