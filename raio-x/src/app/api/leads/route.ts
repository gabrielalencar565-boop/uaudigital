import { NextResponse } from "next/server";
import { AREAS, QUESTIONS } from "@/data/raiox";
import { computeResult, isComplete, type Answers } from "@/lib/scoring";
import { insertLead, isSupabaseConfigured, type LeadRow } from "@/lib/supabase";
import {
  isValidInstagram,
  isValidName,
  isValidWhatsApp,
  normalizeInstagram,
  normalizeWhatsApp,
} from "@/lib/validation";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Requisição inválida.");
  }

  const name = str(body.name, 80);
  const whatsapp = str(body.whatsapp, 30);
  const instagram = str(body.instagram, 60);
  if (!isValidName(name)) return bad("Confere o seu nome.");
  if (!isValidWhatsApp(whatsapp)) return bad("Confere o seu WhatsApp.");
  if (!isValidInstagram(instagram)) return bad("Confere o seu @ do Instagram.");
  if (body.consent !== true) return bad("Precisamos do seu aceite pra liberar o resultado.");

  // Recalcula a nota no servidor a partir das respostas (não confia no navegador).
  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Answers = {};
  for (const q of QUESTIONS) {
    const v = rawAnswers[q.id];
    if (typeof v === "number") answers[q.id] = v;
  }
  if (!isComplete(answers)) return bad("Faltam respostas. Refaz o raio-x, por favor.");
  const result = computeResult(answers);

  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const area = (id: string) => AREAS.find((a) => a.id === id)!.name;

  const row: LeadRow = {
    nome: name,
    whatsapp: normalizeWhatsApp(whatsapp),
    instagram: normalizeInstagram(instagram) || null,
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
    consentimento: true,
    utm_source: str(utm.utm_source) || null,
    utm_medium: str(utm.utm_medium) || null,
    utm_campaign: str(utm.utm_campaign) || null,
    utm_content: str(utm.utm_content) || null,
    user_agent: str(request.headers.get("user-agent"), 300) || null,
  };

  if (!isSupabaseConfigured()) {
    // Plano B: sem Supabase, só registra no log do servidor.
    console.log("[raiox] Lead (Supabase não configurado):", JSON.stringify({ ...row, created_at: new Date().toISOString() }));
    return NextResponse.json({ ok: true, stored: false });
  }

  try {
    await insertLead(row);
    return NextResponse.json({ ok: true, stored: true });
  } catch (err) {
    // Não trava a pessoa: o lead completo fica no log pra recuperar depois.
    console.error("[raiox] Falha ao gravar no Supabase:", err, JSON.stringify(row));
    return NextResponse.json({ ok: true, stored: false });
  }
}
