import { FASES } from "@/data/fases";
import { NICHOS } from "@/data/formulario";
import type { Plano, PlanoMeta, Post } from "./plano";

/**
 * Prompt pronto de cada post: a pessoa copia, cola no ChatGPT/Claude e recebe o roteiro.
 * Montado só com o que já está no planejamento (funciona com a IA ou com o plano B).
 */

const ENTREGA: Record<Post["formato"], string> = {
  reels_com_rosto: `Escreva o roteiro de um Reels de 30 a 45 segundos, gravado com a pessoa da marca aparecendo e falando para a câmera.
Entregue:
1. Gancho falado dos 3 primeiros segundos (use ou melhore o gancho abaixo)
2. Roteiro cena a cena, com: tempo aproximado, o que aparece na tela, a fala exata e o texto que vai escrito na tela
3. Fechamento com o CTA
4. Legenda do post (até 600 caracteres, com quebra de linha e o CTA no fim)
5. 3 opções de texto para a capa do Reels`,
  reels_sem_rosto: `Escreva o roteiro de um Reels de 20 a 40 segundos sem ninguém aparecendo: imagens do dia a dia, detalhes, mãos, ambiente, com texto na tela e narração opcional.
Entregue:
1. Texto de abertura na tela para os 3 primeiros segundos (use ou melhore o gancho abaixo)
2. Roteiro cena a cena, com: tempo aproximado, o que filmar, o texto na tela e a narração (se tiver)
3. Fechamento com o CTA
4. Legenda do post (até 600 caracteres, com quebra de linha e o CTA no fim)
5. Sugestão de estilo de música (sem citar músicas com direitos autorais)`,
  carrossel: `Escreva um carrossel de 7 a 9 slides.
Entregue:
1. Slide 1 (capa): título curto e forte (use ou melhore o gancho abaixo)
2. Slides do meio: um por linha, com título e no máximo 25 palavras de texto cada
3. Último slide: o CTA
4. Sugestão visual rápida para cada slide (o que mostrar ou destacar)
5. Legenda do post (até 600 caracteres, com quebra de linha e o CTA no fim)`,
  estatico: `Escreva um post estático (uma imagem só).
Entregue:
1. Texto principal da arte (no máximo 12 palavras; use ou melhore o gancho abaixo)
2. Texto de apoio da arte (no máximo 20 palavras)
3. Sugestão de imagem ou composição
4. Legenda do post (até 600 caracteres, com quebra de linha e o CTA no fim)`,
};

const FORMATO_NOME: Record<Post["formato"], string> = {
  reels_com_rosto: "Reels com a pessoa aparecendo",
  reels_sem_rosto: "Reels sem rosto",
  carrossel: "Carrossel",
  estatico: "Post estático",
};

function regrasDoNicho(nicho: string): string | null {
  const grupo = NICHOS.find((n) => n.nome === nicho)?.grupo;
  if (grupo === "saude")
    return "É da área da saúde: não prometa resultado, não use antes e depois sem autorização e evite sensacionalismo.";
  if (grupo === "advocacia")
    return "É da advocacia: nada de captação direta de clientes nem promessa de resultado. O CTA deve ser informativo (salvar, compartilhar, tirar dúvida).";
  return null;
}

export function promptDoPost(post: Post, plano: Plano, meta: PlanoMeta, semana: number): string {
  const fase = FASES[post.fase];
  const regras = [
    `Escreva no tom de voz da marca: ${plano.tom_de_voz.descricao}`,
    "Linguagem simples, em português do Brasil, falando com \"você\".",
    "Não invente preços, números, resultados nem depoimentos. Onde precisar de um dado real, deixe [entre colchetes] para eu preencher.",
    regrasDoNicho(meta.nicho),
  ].filter(Boolean);

  return `Você é roteirista de conteúdo para Instagram. Crie o conteúdo de um post a partir das informações abaixo.

SOBRE A MARCA
- Marca: ${meta.cliente}
- Nicho: ${meta.nicho}
- Objetivo do mês: ${plano.objetivo_mes}

PÚBLICO
- Quem é: ${plano.publico.perfil}
- Dor: ${plano.publico.dor}
- Desejo: ${plano.publico.desejo}
- O que faz hesitar: ${plano.publico.objecao_principal}

O POST (semana ${semana}, ${post.dia})
- Formato: ${FORMATO_NOME[post.formato]}
- Papel na jornada: ${fase.nome} (${fase.descricao})
- Gancho: ${post.gancho}
- Ideia: ${post.ideia}
- CTA: ${post.cta}
- Por que esse post existe: ${post.por_que}

O QUE EU PRECISO
${ENTREGA[post.formato]}

REGRAS
${regras.map((r) => `- ${r}`).join("\n")}`;
}
