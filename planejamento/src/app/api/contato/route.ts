import { NextResponse } from "next/server";
import { enviarParaFluxo } from "@/lib/fluxo";
import { ContatoSchema } from "@/lib/input";
import { atualizarLead, inserirLead, supabaseConfigurado, type LeadRow } from "@/lib/supabase";
import { normalizeInstagram, normalizeWhatsApp } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * POST /api/contato: nome, WhatsApp e @ preenchidos ANTES das perguntas.
 * Grava o lead (sem respostas ainda) e manda pro Fluxo, para não perder quem desiste no meio.
 * Devolve o leadId, que o /api/gerar usa depois para completar o mesmo lead.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const contato = ContatoSchema.safeParse(body.contato);
  if (!contato.success) {
    return NextResponse.json({ ok: false, erro: contato.error.issues[0]?.message ?? "Confere os dados." }, { status: 400 });
  }

  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const leadIdAnterior = str(body.leadId, 40);
  const lead: LeadRow = {
    id: UUID.test(leadIdAnterior) ? leadIdAnterior : crypto.randomUUID(),
    nome: contato.data.nome.trim(),
    whatsapp: normalizeWhatsApp(contato.data.whatsapp),
    instagram: normalizeInstagram(contato.data.instagram) || null,
    consentimento: true,
    respostas: null,
    nicho: null,
    objetivo: null,
    utm_source: str(utm.utm_source) || null,
    utm_medium: str(utm.utm_medium) || null,
    utm_campaign: str(utm.utm_campaign) || null,
    utm_content: str(utm.utm_content) || null,
    user_agent: str(request.headers.get("user-agent"), 300) || null,
  };

  // Funil comercial do Fluxo (se FLUXO_FORM_SLUG estiver configurado). Corre em paralelo e nunca trava.
  const utmTexto = [lead.utm_source, lead.utm_medium, lead.utm_campaign, lead.utm_content].filter(Boolean).join(" / ");
  const fluxo = enviarParaFluxo({
    nome: lead.nome,
    whatsapp: lead.whatsapp,
    instagram: lead.instagram,
    origem: "Planejamento do Mês em 5 Minutos",
    resumo: `Começou o Planejamento do Mês (ainda respondendo as perguntas).${utmTexto ? ` Origem do link: ${utmTexto}.` : ""}`,
  });

  let gravado = false;
  if (!supabaseConfigurado()) {
    console.log("[planejamento] Contato (Supabase não configurado):", JSON.stringify({ ...lead, created_at: new Date().toISOString() }));
  } else {
    try {
      // Mesma pessoa voltando: só atualiza o contato do lead que já existe.
      const existe = UUID.test(leadIdAnterior)
        ? await atualizarLead(lead.id, { nome: lead.nome, whatsapp: lead.whatsapp, instagram: lead.instagram })
        : false;
      if (!existe) await inserirLead(lead);
      gravado = true;
    } catch (erro) {
      // Não trava a pessoa: o contato fica no log para recuperar depois.
      console.error("[planejamento] Falha ao gravar contato:", erro, JSON.stringify(lead));
    }
  }

  await fluxo;
  return NextResponse.json({ ok: true, leadId: lead.id, gravado });
}
