import "server-only";
import type { Plano, PlanoMeta, PlanoSalvo } from "./plano";

/**
 * Acesso ao Supabase pela API REST (PostgREST), só no servidor,
 * com a SUPABASE_SERVICE_ROLE_KEY (aceita a chave nova sb_secret_ e a antiga service_role).
 */

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function supabaseConfigurado() {
  return config() !== null;
}

function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = { apikey: key, "Content-Type": "application/json", ...extra };
  return key.startsWith("sb_") ? base : { ...base, Authorization: `Bearer ${key}` };
}

async function rest(caminho: string, init: RequestInit & { extraHeaders?: Record<string, string> } = {}) {
  const c = config();
  if (!c) throw new Error("Supabase não configurado");
  const res = await fetch(`${c.url}/rest/v1/${caminho}`, {
    ...init,
    headers: headers(c.key, init.extraHeaders),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res;
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export type LeadRow = {
  id: string;
  nome: string;
  whatsapp: string;
  instagram: string | null;
  consentimento: boolean;
  respostas: unknown;
  nicho: string | null;
  objetivo: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  user_agent: string | null;
};

export async function inserirLead(row: LeadRow) {
  await rest("leads", { method: "POST", body: JSON.stringify(row), extraHeaders: { Prefer: "return=minimal" } });
}

/** Atualiza as últimas respostas do lead (ao planejar outro cliente). */
export async function atualizarLead(id: string, patch: Partial<LeadRow>): Promise<boolean> {
  const res = await rest(`leads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    extraHeaders: { Prefer: "return=representation" },
  });
  return ((await res.json()) as unknown[]).length > 0;
}

export type LeadAdmin = LeadRow & { created_at: string; geracoes: { count: number }[] };

export async function listarLeads(limite = 5000): Promise<LeadAdmin[]> {
  const res = await rest(`leads?select=*,geracoes(count)&order=created_at.desc&limit=${limite}`);
  return (await res.json()) as LeadAdmin[];
}

/* ------------------------------------------------------------------ */
/* Gerações                                                            */
/* ------------------------------------------------------------------ */

export type GeracaoRow = {
  id: string;
  lead_id: string;
  whatsapp: string;
  ip: string | null;
  fonte: PlanoMeta["fonte"];
  modelo: string | null;
  mes: string;
  cliente_nome: string;
  nicho: string;
  objetivo: string;
  respostas: unknown;
  plano: Plano;
};

export async function inserirGeracao(row: GeracaoRow) {
  await rest("geracoes", { method: "POST", body: JSON.stringify(row), extraHeaders: { Prefer: "return=minimal" } });
}

/** Plano salvo para a página /p/[id]. Não traz o contato do lead. */
export async function buscarPlano(id: string): Promise<PlanoSalvo | null> {
  const res = await rest(`geracoes?id=eq.${encodeURIComponent(id)}&select=id,created_at,mes,cliente_nome,nicho,fonte,plano&limit=1`);
  const [g] = (await res.json()) as {
    id: string;
    created_at: string;
    mes: string;
    cliente_nome: string;
    nicho: string;
    fonte: PlanoMeta["fonte"];
    plano: Plano;
  }[];
  if (!g) return null;
  return {
    id: g.id,
    criado_em: g.created_at,
    plano: g.plano,
    meta: { mes: g.mes, cliente: g.cliente_nome, nicho: g.nicho, fonte: g.fonte },
  };
}

/** Quantas gerações desde `desde` que batem com o filtro (ex.: whatsapp=eq.55...). */
export async function contarGeracoes(filtro: string, desde: Date): Promise<number> {
  const res = await rest(`geracoes?select=id&${filtro}&created_at=gte.${encodeURIComponent(desde.toISOString())}`, {
    method: "HEAD",
    extraHeaders: { Prefer: "count=exact", Range: "0-0" },
  });
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}
