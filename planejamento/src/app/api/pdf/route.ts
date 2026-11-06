import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import PdfDocument from "@/components/PdfDocument";
import { PlanoSchema, type Plano, type PlanoMeta } from "@/lib/plano";
import { buscarPlano, supabaseConfigurado } from "@/lib/supabase";

export const runtime = "nodejs";

const MetaSchema = z.object({
  mes: z.string().min(3).max(40),
  cliente: z.string().min(1).max(80),
  nicho: z.string().min(1).max(80),
  fonte: z.enum(["ia", "modelo"]),
});

function arquivo(meta: PlanoMeta) {
  return `planejamento-${meta.mes}-${meta.cliente}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function responderPdf(plano: Plano, meta: PlanoMeta) {
  const buffer = await renderToBuffer(createElement(PdfDocument, { plano, meta }) as Parameters<typeof renderToBuffer>[0]);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo(meta)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

/** POST com o plano no corpo: funciona com ou sem Supabase. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { plano?: unknown; meta?: unknown } | null;
  const plano = PlanoSchema.safeParse(body?.plano);
  const meta = MetaSchema.safeParse(body?.meta);
  if (!plano.success || !meta.success) return new Response("Planejamento inválido", { status: 400 });
  try {
    return await responderPdf(plano.data, meta.data);
  } catch (erro) {
    console.error("[planejamento] Falha ao gerar PDF:", erro);
    return new Response("Falha ao gerar o PDF", { status: 500 });
  }
}

/** GET /api/pdf?id=... para planejamentos salvos no Supabase. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !supabaseConfigurado()) return new Response("Não encontrado", { status: 404 });
  try {
    const salvo = await buscarPlano(id);
    if (!salvo) return new Response("Não encontrado", { status: 404 });
    return await responderPdf(salvo.plano, salvo.meta);
  } catch (erro) {
    console.error("[planejamento] Falha ao gerar PDF:", erro);
    return new Response("Falha ao gerar o PDF", { status: 500 });
  }
}
