import { isAdmin } from "@/lib/admin-auth";
import { listLeads } from "@/lib/supabase";

const COLUMNS = [
  "created_at", "nome", "whatsapp", "instagram", "nota_geral", "nivel", "gargalo",
  "nota_objetivo", "nota_diagnostico", "nota_concorrentes", "nota_conteudo", "nota_apresentacao", "nota_valor",
  "utm_source", "utm_medium", "utm_campaign", "utm_content",
] as const;

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Evita injeção de fórmula no Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Não autorizado", { status: 401 });
  try {
    const leads = await listLeads();
    const lines = [COLUMNS.join(";"), ...leads.map((l) => COLUMNS.map((c) => cell(l[c])).join(";"))];
    const date = new Date().toISOString().slice(0, 10);
    // BOM + ";" pra abrir certinho no Excel em português.
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-raiox-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`Erro: ${(e as Error).message}`, { status: 500 });
  }
}
