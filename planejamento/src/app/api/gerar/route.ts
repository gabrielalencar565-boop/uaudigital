import { NextResponse } from "next/server";
import { COPY } from "@/data/textos";
import { montarEsqueleto } from "@/lib/distribuicao";
import { gerarComIA, MODELO_PADRAO } from "@/lib/ia";
import { ContatoSchema, FormSchema, nomeDoNicho } from "@/lib/input";
import { dentroDoLimite, ipDaRequisicao, registrarNaMemoria } from "@/lib/limites";
import { gerarPlanoModelo } from "@/lib/modeloB";
import { mesAtual, type PlanoMeta } from "@/lib/plano";
import { atualizarLead, inserirGeracao, inserirLead, supabaseConfigurado, type LeadRow } from "@/lib/supabase";
import { normalizeInstagram, normalizeWhatsApp } from "@/lib/validation";

// A geração pode levar até ~45 s (prazo da IA) + gravações.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const form = FormSchema.safeParse(body.form);
  const contato = ContatoSchema.safeParse(body.contato);
  if (!form.success || !contato.success) {
    const msg = (form.success ? contato.error?.issues[0]?.message : form.error.issues[0]?.message) ?? "Confere os dados.";
    return NextResponse.json({ ok: false, erro: msg }, { status: 400 });
  }

  const whatsapp = normalizeWhatsApp(contato.data.whatsapp);
  const ip = ipDaRequisicao(request);
  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const respostas = form.data;

  // 1) Grava o lead ANTES de chamar a IA.
  let leadId = str(body.leadId, 40);
  const lead: LeadRow = {
    id: UUID.test(leadId) ? leadId : crypto.randomUUID(),
    nome: contato.data.nome.trim(),
    whatsapp,
    instagram: normalizeInstagram(contato.data.instagram) || null,
    consentimento: true,
    respostas,
    nicho: nomeDoNicho(respostas),
    objetivo: respostas.objetivo,
    utm_source: str(utm.utm_source) || null,
    utm_medium: str(utm.utm_medium) || null,
    utm_campaign: str(utm.utm_campaign) || null,
    utm_content: str(utm.utm_content) || null,
    user_agent: str(request.headers.get("user-agent"), 300) || null,
  };
  leadId = lead.id;
  if (!supabaseConfigurado()) {
    console.log("[planejamento] Lead (Supabase não configurado):", JSON.stringify({ ...lead, created_at: new Date().toISOString() }));
  } else {
    try {
      const existe = UUID.test(str(body.leadId, 40))
        ? await atualizarLead(lead.id, {
            nome: lead.nome,
            instagram: lead.instagram,
            respostas: lead.respostas,
            nicho: lead.nicho,
            objetivo: lead.objetivo,
          })
        : false;
      if (!existe) await inserirLead(lead);
    } catch (erro) {
      console.error("[planejamento] Falha ao gravar lead:", erro, JSON.stringify(lead));
    }
  }

  // 2) Limite de uso por WhatsApp e por IP.
  if (!(await dentroDoLimite(whatsapp, ip))) {
    return NextResponse.json({ ok: false, limite: true, erro: COPY.limite, leadId }, { status: 429 });
  }

  // 3) Gera: IA primeiro, plano B se não der.
  const mes = mesAtual();
  const esqueleto = montarEsqueleto(respostas);
  const daIA = await gerarComIA(respostas, esqueleto, mes);
  const plano = daIA ?? gerarPlanoModelo(respostas, mes, esqueleto);
  const meta: PlanoMeta = { mes, cliente: respostas.cliente, nicho: nomeDoNicho(respostas), fonte: daIA ? "ia" : "modelo" };

  // 4) Salva a geração (para /p/[id], PDF e limites).
  const id = crypto.randomUUID();
  const criado_em = new Date().toISOString();
  registrarNaMemoria(whatsapp, ip);
  if (supabaseConfigurado()) {
    try {
      await inserirGeracao({
        id,
        lead_id: leadId,
        whatsapp,
        ip,
        fonte: meta.fonte,
        modelo: daIA ? process.env.ANTHROPIC_MODEL || MODELO_PADRAO : null,
        mes,
        cliente_nome: respostas.cliente,
        nicho: meta.nicho,
        objetivo: respostas.objetivo,
        respostas,
        plano,
      });
    } catch (erro) {
      console.error("[planejamento] Falha ao gravar geração:", erro);
    }
  } else {
    console.log(`[planejamento] Geração ${id} (${meta.fonte}) para ${respostas.cliente}`);
  }

  return NextResponse.json({ ok: true, id, leadId, criado_em, plano, meta });
}
