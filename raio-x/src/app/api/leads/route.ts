import { NextResponse } from "next/server";
import { AREAS, QUESTIONS } from "@/data/raiox";
import { computeResult, isComplete, type Answers } from "@/lib/scoring";
import { enviarParaFluxo } from "@/lib/fluxo";
import { bandFor } from "@/lib/scoring";
import { insertLead, isSupabaseConfigured, updateLead, type LeadContact, type LeadResult } from "@/lib/supabase";
import {
  isValidInstagram,
  isValidName,
  isValidWhatsApp,
  normalizeInstagram,
  normalizeWhatsApp,
} from "@/lib/validation";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/leads: contato preenchido ANTES das perguntas.
 * Cria o lead com status "iniciado" e devolve o id, usado no PATCH do final.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return bad("Requisição inválida.");

  const name = str(body.name, 80);
  const whatsapp = str(body.whatsapp, 30);
  const instagram = str(body.instagram, 60);
  if (!isValidName(name)) return bad("Confere o seu nome.");
  if (!isValidWhatsApp(whatsapp)) return bad("Confere o seu WhatsApp.");
  if (!isValidInstagram(instagram)) return bad("Confere o seu @ do Instagram.");
  if (body.consent !== true) return bad("Precisamos do seu aceite pra continuar.");

  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const row: LeadContact = {
    id: crypto.randomUUID(),
    nome: name,
    whatsapp: normalizeWhatsApp(whatsapp),
    instagram: normalizeInstagram(instagram) || null,
    consentimento: true,
    utm_source: str(utm.utm_source) || null,
    utm_medium: str(utm.utm_medium) || null,
    utm_campaign: str(utm.utm_campaign) || null,
    utm_content: str(utm.utm_content) || null,
    user_agent: str(request.headers.get("user-agent"), 300) || null,
    status: "iniciado",
  };

  // Funil comercial do Fluxo (se FLUXO_FORM_SLUG estiver configurado). Nunca trava o teste.
  const utmTexto = [row.utm_source, row.utm_medium, row.utm_campaign, row.utm_content].filter(Boolean).join(" / ");
  const fluxo = enviarParaFluxo({
    nome: row.nome,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    origem: "Raio-X do Social Media",
    resumo: `Iniciou o Raio-X do Social Media.${utmTexto ? ` Origem do link: ${utmTexto}.` : ""}`,
  });

  if (!isSupabaseConfigured()) {
    await fluxo;
    // Plano B: sem Supabase, só registra no log do servidor.
    console.log("[raiox] Lead iniciado (Supabase não configurado):", JSON.stringify({ ...row, created_at: new Date().toISOString() }));
    return NextResponse.json({ ok: true, id: row.id, stored: false });
  }

  try {
    await Promise.all([insertLead(row), fluxo]);
    return NextResponse.json({ ok: true, id: row.id, stored: true });
  } catch (err) {
    // Não trava a pessoa: o lead completo fica no log pra recuperar depois.
    console.error("[raiox] Falha ao gravar lead no Supabase:", err, JSON.stringify(row));
    return NextResponse.json({ ok: true, id: row.id, stored: false });
  }
}

/**
 * PATCH /api/leads: ao terminar as perguntas.
 * Recalcula a nota no servidor (não confia no navegador) e completa o lead.
 */
export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (!body) return bad("Requisição inválida.");

  const id = str(body.id, 40);
  if (!UUID.test(id)) return bad("Lead inválido.");

  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Answers = {};
  for (const q of QUESTIONS) {
    const v = rawAnswers[q.id];
    if (typeof v === "number") answers[q.id] = v;
  }
  if (!isComplete(answers)) return bad("Faltam respostas.");

  const result = computeResult(answers);
  const area = (aid: string) => AREAS.find((a) => a.id === aid)!.name;
  const patch: LeadResult = {
    nota_geral: result.overall,
    nota_objetivo: result.areas.objetivo,
    nota_diagnostico: result.areas.diagnostico,
    nota_concorrentes: result.areas.concorrentes,
    nota_conteudo: result.areas.conteudo,
    nota_apresentacao: result.areas.apresentacao,
    nota_valor: result.areas.valor,
    nivel: result.level.name,
    gargalo: area(result.bottleneck),
    // Respostas legíveis: pergunta, opção escolhida e pontos.
    respostas: QUESTIONS.map((q) => ({
      id: q.id,
      area: q.area,
      pergunta: q.text,
      resposta: q.options[answers[q.id]].text,
      pontos: q.options[answers[q.id]].points,
    })),
    status: "concluido",
    concluido_em: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    console.log("[raiox] Lead concluído (Supabase não configurado):", JSON.stringify({ id, ...patch }));
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    const contato = await updateLead(id, patch);
    if (!contato) {
      console.error("[raiox] Lead não encontrado para concluir:", id, JSON.stringify(patch));
      return NextResponse.json({ ok: true, stored: false });
    }
    // Nota com o resultado no mesmo lead do Fluxo (ele reconhece pelo WhatsApp).
    const notas = AREAS.map((a) => `${a.name} ${result.areas[a.id]} (${bandFor(result.areas[a.id]).name})`).join(" · ");
    await enviarParaFluxo({
      nome: contato.nome,
      whatsapp: contato.whatsapp,
      instagram: contato.instagram,
      origem: "Raio-X do Social Media",
      resumo: `Concluiu o Raio-X. Nota geral: ${result.overall}/100 · Nível: ${result.level.name} · Principal gargalo: ${area(result.bottleneck)}. Notas por área: ${notas}.`,
    });
    return NextResponse.json({ ok: true, stored: true });
  } catch (err) {
    console.error("[raiox] Falha ao concluir lead no Supabase:", err, JSON.stringify({ id, ...patch }));
    return NextResponse.json({ ok: true, stored: false });
  }
}
