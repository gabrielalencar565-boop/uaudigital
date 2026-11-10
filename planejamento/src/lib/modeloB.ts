import { FASE_IDS, type FaseId } from "@/data/fases";
import { OBJECOES, type ObjecaoId } from "@/data/formulario";
import {
  CONVERSAO_POR_NICHO,
  FOCO_POR_FASE,
  FRASES_APRESENTAR,
  METAS,
  MODELO_DATA_ESPECIAL,
  MODELOS,
  MODELOS_RESISTENCIA,
  OBJECAO_CURTA,
  OBJECAO_TEXTO,
  OBJETIVO_TEXTO,
  POR_QUE_POR_FASE,
  STORIES,
  STORY_VENDA,
  TERMO_CLIENTE,
  TOM_TEXTO,
  type ModeloPostRegulado,
} from "@/data/modelos";
import { montarEsqueleto, semanaDaData, type Esqueleto } from "./distribuicao";
import { grupoDoNicho, type FormInput } from "./input";
import type { Plano, Post } from "./plano";

const maiuscula = (s: string) => (s ? s[0].toLocaleUpperCase("pt-BR") + s.slice(1) : s);
const minuscula = (s: string) => (s ? s[0].toLocaleLowerCase("pt-BR") + s.slice(1) : s);
/** Tira ponto final, pra encaixar o texto do usuário no meio de uma frase. */
const limpo = (s: string) => s.trim().replace(/[.!]+$/, "");

export type Variaveis = Record<string, string>;

export function variaveisDoForm(form: FormInput, mes: string): Variaveis {
  const grupo = grupoDoNicho(form.nicho);
  const objecaoPrincipal = form.objecoes[0];
  const objecao = objecaoPrincipal ? OBJECAO_CURTA[objecaoPrincipal] : limpo(form.objecaoOutro) || "preço";
  const servico = minuscula(limpo(form.servico));
  const dor = minuscula(limpo(form.dor));
  const termo = TERMO_CLIENTE[grupo];
  const v: Variaveis = {
    marca: limpo(form.cliente),
    servico,
    Servico: maiuscula(servico),
    publico: minuscula(limpo(form.publico)),
    dor,
    Dor: maiuscula(dor),
    cidade: form.cidade.trim() ? ` em ${limpo(form.cidade)}` : "",
    objecao,
    conversao: CONVERSAO_POR_NICHO[form.nicho] ?? "contatos de clientes interessados",
    termo,
    Termo: maiuscula(termo),
    mes: mes.split(" de ")[0],
    dataEspecial: limpo(form.dataEspecial),
  };
  const objetivo = OBJETIVO_TEXTO[form.objetivo];
  v.resultado = preencher(objetivo.resultado, v);
  v.objetivoCurto = preencher(objetivo.curto, v);
  return v;
}

export function preencher(texto: string, v: Variaveis): string {
  return texto.replace(/\{(\w+)\}/g, (_, chave: string) => v[chave] ?? "");
}

function modelosDaFase(fase: FaseId, form: FormInput): ModeloPostRegulado[] {
  const grupo = grupoDoNicho(form.nicho);
  if (fase === "resistencia") {
    const lista: ModeloPostRegulado[] = [];
    // Intercala as objeções marcadas, na ordem em que a pessoa escolheu.
    const objecoes: (ObjecaoId | "outro")[] = [...form.objecoes];
    if (form.objecaoOutro.trim()) objecoes.push("outro");
    if (objecoes.length === 0) objecoes.push("preco");
    const maior = Math.max(...objecoes.map((o) => MODELOS_RESISTENCIA[o].length));
    for (let i = 0; i < maior; i++) {
      for (const o of objecoes) if (MODELOS_RESISTENCIA[o][i]) lista.push(MODELOS_RESISTENCIA[o][i]);
    }
    return lista;
  }
  let lista = MODELOS[fase];
  // Advocacia: sem "antes e depois" (regras da OAB).
  if (grupo === "advocacia") lista = lista.filter((m) => !/antes e depois/i.test(m.gancho));
  return lista;
}

function montarPost(modelo: ModeloPostRegulado, form: FormInput, v: Variaveis): Omit<Post, "dia" | "fase" | "formato"> {
  const regulado = grupoDoNicho(form.nicho) !== "geral";
  const saude = grupoDoNicho(form.nicho) === "saude";
  const gancho = saude && modelo.ganchoSaude ? modelo.ganchoSaude : modelo.gancho;
  const ideia = saude && modelo.ideiaSaude ? modelo.ideiaSaude : modelo.ideia;
  const cta = regulado && modelo.ctaRegulado ? modelo.ctaRegulado : modelo.cta;
  return { gancho: preencher(gancho, v), ideia: preencher(ideia, v), cta: preencher(cta, v), por_que: "" };
}

/** Plano completo a partir dos modelos prontos (sem IA). Nunca falha. */
export function gerarPlanoModelo(form: FormInput, mes: string, esqueleto: Esqueleto = montarEsqueleto(form)): Plano {
  const v = variaveisDoForm(form, mes);
  const usados: Partial<Record<FaseId, number>> = {};
  const semanaEspecial = semanaDaData(form.dataEspecial);

  const semanas = esqueleto.map((slots, s) => {
    const posts: Post[] = slots.map((slot) => {
      const lista = modelosDaFase(slot.fase, form);
      const n = usados[slot.fase] ?? 0;
      usados[slot.fase] = n + 1;
      const base = montarPost(lista[n % lista.length], form, v);
      return { ...slot, ...base, por_que: preencher(POR_QUE_POR_FASE[slot.fase], v) };
    });

    // Data especial: entra no lugar de um post de Recompensa/Solução/Identificação da semana certa.
    if (semanaEspecial === s + 1 && v.dataEspecial) {
      const prioridade: FaseId[] = ["recompensa", "solucao", "identificacao", "autoridade", "prova_social", "resistencia"];
      const alvo = prioridade.map((f) => posts.findIndex((p) => p.fase === f)).find((i) => i >= 0) ?? posts.length - 1;
      posts[alvo] = {
        ...posts[alvo],
        gancho: preencher(MODELO_DATA_ESPECIAL.gancho, v),
        ideia: preencher(MODELO_DATA_ESPECIAL.ideia, v),
        cta: preencher(MODELO_DATA_ESPECIAL.cta, v),
        por_que: `Encaixa a data importante do mês (${v.dataEspecial}) nesta semana, aproveitando a atenção do público pra ${v.resultado}.`,
      };
    }

    return { numero: s + 1, foco: focoDaSemana(slots.map((p) => p.fase)), posts };
  });

  const metas = METAS[form.objetivo].map((m) => ({ meta: preencher(m.meta, v), indicador: preencher(m.indicador, v) }));
  const objecaoPrincipal = form.objecoes[0];
  const tom = TOM_TEXTO[form.tom];
  const stories = STORIES.map((s) => preencher(s, v));
  if (form.objetivo === "vender" || form.objetivo === "lancar") stories.push(STORY_VENDA);

  return {
    objetivo_mes: `Fazer ${v.marca} ser vista como ${preencher(OBJETIVO_TEXTO[form.objetivo].posicao, v)} por ${v.publico}${v.cidade}, gerando ${v.resultado}.`,
    metas,
    publico: {
      perfil: maiuscula(`${v.publico}${v.cidade}.`),
      dor: maiuscula(`${v.dor}.`),
      desejo: `Resolver ${v.dor} de um jeito seguro, sem complicação e com quem entende do assunto.`,
      objecao_principal: objecaoPrincipal
        ? preencher(OBJECAO_TEXTO[objecaoPrincipal], v)
        : maiuscula(`${limpo(form.objecaoOutro)}.`),
    },
    tom_de_voz: { descricao: tom.descricao, exemplos: tom.exemplos.map((e) => preencher(e, v)) },
    semanas,
    stories_recorrentes: stories.slice(0, 5),
    frases_para_apresentar: FRASES_APRESENTAR.map((f) =>
      preencher(f, { ...v, indicador: minuscula(metas[0].meta) }),
    ),
  };
}

function focoDaSemana(fases: FaseId[]): string {
  const contagem = new Map<FaseId, number>();
  for (const f of fases) contagem.set(f, (contagem.get(f) ?? 0) + 1);
  const ordenadas = [...contagem.entries()].sort(
    (a, b) => b[1] - a[1] || FASE_IDS.indexOf(a[0]) - FASE_IDS.indexOf(b[0]),
  );
  return FOCO_POR_FASE[ordenadas[0][0]];
}

/** Nome legível das objeções marcadas (para o prompt e para a tela). */
export function objecoesLegiveis(form: FormInput): string[] {
  const nomes = form.objecoes.map((id) => OBJECOES.find((o) => o.id === id)!.nome);
  if (form.objecaoOutro.trim()) nomes.push(limpo(form.objecaoOutro));
  return nomes;
}
