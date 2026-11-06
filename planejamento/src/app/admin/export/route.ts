import { isAdmin } from "@/lib/admin-auth";
import { listarLeads } from "@/lib/supabase";

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Evita injeção de fórmula no Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Não autorizado", { status: 401 });
  try {
    const leads = await listarLeads();
    const cabecalho = ["created_at", "nome", "whatsapp", "instagram", "nicho", "objetivo", "geracoes", "utm_source", "utm_medium", "utm_campaign", "utm_content"];
    const linhas = leads.map((l) =>
      [l.created_at, l.nome, l.whatsapp, l.instagram, l.nicho, l.objetivo, l.geracoes?.[0]?.count ?? 0, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content]
        .map(cell)
        .join(";"),
    );
    const data = new Date().toISOString().slice(0, 10);
    // BOM + ";" pra abrir certinho no Excel em português.
    return new Response("﻿" + [cabecalho.join(";"), ...linhas].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-planejamento-${data}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`Erro: ${(e as Error).message}`, { status: 500 });
  }
}
