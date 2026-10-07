import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ENTRADA = ["receita_recorrente", "receita_variavel", "receita_outros"];
const SAIDA = [
  "impostos", "despesa_operacional", "despesa_administrativa", "despesa_financeira",
  "despesa_comercial", "despesa_outros", "despesa_variavel", "investimentos",
];
const CATEGORY_HELP: Record<string, string> = {
  receita_recorrente: "mensalidades/contratos de clientes que se repetem todo mês",
  receita_variavel: "receitas de serviços avulsos ou por projeto",
  receita_outros: "outras entradas (estornos, rendimentos, reembolsos)",
  impostos: "impostos e taxas governamentais (DAS, Simples, ISS, DARF, INSS, FGTS)",
  despesa_operacional: "custos de produzir o serviço (equipe, freelancers, ferramentas de produção, anúncios dos clientes)",
  despesa_administrativa: "custos de manter a empresa (aluguel, contador, software de gestão, internet, energia)",
  despesa_financeira: "tarifas bancárias, juros, IOF, multas, parcelas de empréstimo",
  despesa_comercial: "vendas e marketing próprio da empresa",
  despesa_outros: "despesas que não cabem nas outras categorias",
  despesa_variavel: "despesas que variam conforme o volume de trabalho",
  investimentos: "aplicações, equipamentos, capital investido",
};

const MAX_ITEMS = 80;
const MAX_EXAMPLES = 60;
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Suggests a category for bank-statement lines the agency's own history couldn't decide. Only for signed-in users
// (it spends our Gemini key); nothing here reads or writes the database — the client sends the lines and saves them
// itself after the user reviews the suggestions.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user?.id) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const rawItems = Array.isArray(body?.items) ? body.items : null;
    if (!rawItems || rawItems.length === 0 || rawItems.length > MAX_ITEMS) return json({ error: "invalid_items" }, 400);

    const items = rawItems.map((it: any, k: number) => ({
      id: Number.isInteger(it?.id) ? it.id : k,
      description: String(it?.description ?? "").slice(0, 120),
      type: it?.type === "entrada" ? "entrada" : "saida",
      amount: Number(it?.amount) || 0,
    }));
    const examples = (Array.isArray(body?.examples) ? body.examples : []).slice(0, MAX_EXAMPLES)
      .map((e: any) => ({ description: String(e?.description ?? "").slice(0, 80), category: String(e?.category ?? "") }))
      .filter((e: any) => ENTRADA.includes(e.category) || SAIDA.includes(e.category));

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "ai_not_configured" }, 500);

    const system =
      "Você classifica lançamentos de extrato bancário de uma agência de marketing digital brasileira. " +
      "Para cada lançamento escolha UMA categoria da lista permitida para o tipo dele (entrada ou saida). " +
      "Use os exemplos já classificados pela própria empresa como referência principal. " +
      "Se não houver base suficiente, escolha a categoria mais provável e marque confidence como baixa. " +
      "Categorias de entrada: " + ENTRADA.map((c) => `${c} (${CATEGORY_HELP[c]})`).join("; ") + ". " +
      "Categorias de saida: " + SAIDA.map((c) => `${c} (${CATEGORY_HELP[c]})`).join("; ") + ". " +
      "Responda somente o JSON pedido.";
    const prompt =
      `Exemplos já classificados:\n${examples.map((e: any) => `- "${e.description}" => ${e.category}`).join("\n") || "(nenhum)"}\n\n` +
      `Lançamentos a classificar (id | tipo | valor | descrição):\n` +
      items.map((i: any) => `${i.id} | ${i.type} | ${i.amount.toFixed(2)} | ${i.description}`).join("\n");

    const buildBody = (lowThinking: boolean) => JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        // classifying lines needs no long reasoning; "low" keeps big statements fast
        ...(lowThinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "INTEGER" },
              category: { type: "STRING", format: "enum", enum: [...ENTRADA, ...SAIDA] },
              confidence: { type: "STRING", format: "enum", enum: ["alta", "media", "baixa"] },
            },
            required: ["id", "category", "confidence"],
          },
        },
      },
    });

    // Google's API fails now and then (overloaded / rate limit): try up to 3 times before giving up.
    let resp: Response | null = null;
    let lastStatus = 0;
    let lastDetail = "";
    let lowThinking = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt * 1500);
      resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: buildBody(lowThinking),
      });
      if (resp.ok) break;
      lastStatus = resp.status;
      lastDetail = (await resp.text()).slice(0, 200);
      console.error("gemini error", attempt, lastStatus, lastDetail);
      resp = null;
      if (lastStatus === 400 && lowThinking && /thinking/i.test(lastDetail)) { lowThinking = false; continue; }
      if (![429, 500, 502, 503, 504].includes(lastStatus)) break;
    }
    if (!resp) return json({ error: lastStatus === 429 ? "rate_limited" : "ai_failed", status: lastStatus, detail: lastDetail }, 502);

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "[]";
    let parsed: any[] = [];
    try { parsed = JSON.parse(text); } catch { return json({ error: "bad_ai_response", detail: `finish=${data.candidates?.[0]?.finishReason ?? "?"} len=${text.length}` }, 502); }

    // never trust the model with the family of the category: an entrada can't become a despesa and vice-versa
    const typeById = new Map<number, string>(items.map((i: any) => [i.id, i.type]));
    const results = (Array.isArray(parsed) ? parsed : [])
      .filter((r) => typeById.has(r?.id))
      .filter((r) => (typeById.get(r.id) === "entrada" ? ENTRADA : SAIDA).includes(r.category))
      .map((r) => ({ id: r.id, category: r.category, confidence: ["alta", "media", "baixa"].includes(r.confidence) ? r.confidence : "baixa" }));
    return json({ results });
  } catch (e) {
    console.error("finance-categorize error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
