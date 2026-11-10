import { FASES } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import { rotuloDoPost } from "./datas";
import type { PlanoSalvo } from "./plano";

const formato = (id: string) => FORMATOS.find((f) => f.id === id);

/** Planejamento em texto, formatado para colar no WhatsApp (negrito com *) ou no Notion. */
export function planoParaTexto({ plano, meta }: PlanoSalvo): string {
  const l: string[] = [];
  l.push(`*PLANEJAMENTO DE ${meta.mes.toUpperCase()} · ${meta.cliente.toUpperCase()}*`);
  l.push(meta.nicho, "");
  l.push("🎯 *Objetivo do mês*", plano.objetivo_mes, "");
  for (const m of plano.metas) l.push(`• ${m.meta}: ${m.indicador}`);
  l.push("", "👥 *Para quem estamos falando*");
  l.push(`• Perfil: ${plano.publico.perfil}`);
  l.push(`• Dor: ${plano.publico.dor}`);
  l.push(`• Desejo: ${plano.publico.desejo}`);
  l.push(`• Objeção principal: ${plano.publico.objecao_principal}`);
  l.push("", "🗣️ *Tom de voz*", plano.tom_de_voz.descricao);
  for (const e of plano.tom_de_voz.exemplos) l.push(`• "${e}"`);
  for (const s of plano.semanas) {
    l.push("", `📅 *Semana ${s.numero} · ${s.foco}*`);
    for (const p of s.posts) {
      const f = formato(p.formato);
      l.push(`*${rotuloDoPost(meta.mes, s.numero, p)}* · ${FASES[p.fase].nome} · ${f?.icone ?? ""} ${f?.curto ?? p.formato}`);
      l.push(`Gancho: ${p.gancho}`);
      l.push(`Ideia: ${p.ideia}`);
      l.push(`CTA: ${p.cta}`);
      l.push(`Por que: ${p.por_que}`, "");
    }
  }
  l.push("⏱️ *Stories da semana*");
  for (const s of plano.stories_recorrentes) l.push(`• ${s}`);
  l.push("", "Feito com o Planejamento do Mês em 5 Minutos · @uaudigital");
  return l.join("\n");
}
