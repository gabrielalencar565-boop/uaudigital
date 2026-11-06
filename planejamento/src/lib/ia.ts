import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FASE_IDS, FASES } from "@/data/fases";
import { FORMATOS, TONS } from "@/data/formulario";
import { contagemFases, diasDaSemana, semanaDaData, type Esqueleto } from "./distribuicao";
import { grupoDoNicho, nomeDoNicho, type FormInput } from "./input";
import { objecoesLegiveis } from "./modeloB";
import { PlanoSchema, validarPlano, type Plano } from "./plano";

export const MODELO_PADRAO = "claude-sonnet-5-5";
const PRAZO_TOTAL_MS = 45_000;
/** Não começa uma nova tentativa se sobrar menos que isso do prazo. */
const MINIMO_PARA_TENTAR_MS = 12_000;

/** Prompt de sistema da seção 8 do briefing (fixo, pra aproveitar o cache de prompt). */
export const PROMPT_SISTEMA = `Você é estrategista de conteúdo sênior de uma agência brasileira de marketing. Sua tarefa é criar o planejamento de conteúdo de Instagram de UM mês para o cliente descrito abaixo.

Regras:
1. Escreva em português do Brasil, com linguagem simples e direta, no tom de voz pedido para a marca.
2. Todo post precisa ter um papel claro em uma das 6 fases da jornada: identificação, solução, resistência, autoridade, prova social e recompensa. Siga a distribuição de fases e de formatos enviada.
3. Os ganchos devem ser específicos para o nicho, o serviço, a dor e a objeção informados. Nada de frases genéricas como "Dicas incríveis para você". Use perguntas, números e situações reais do público.
4. Não invente dados, preços, resultados, depoimentos ou estatísticas. Em prova social, sugira o formato (ex.: "depoimento em vídeo de um paciente, com autorização") sem inventar a fala.
5. Respeite as regras de publicidade da área do cliente. Para saúde (médicos, dentistas, psicólogos, nutricionistas), nada de promessa de resultado nem de antes e depois sem autorização, e nada de sensacionalismo. Para advogados, nada de captação direta de clientes nem promessa de resultado.
6. Use apenas os formatos que o cliente aceita.
7. Responda somente com o JSON no schema fornecido, sem texto fora dele.

As 6 fases:
${FASE_IDS.map((id) => `- ${id}: ${FASES[id].descricao}`).join("\n")}

Formato dos campos:
- objetivo_mes: uma frase no formato "Fazer [marca] ser vista como [posição] por [público], gerando [resultado]".
- metas: exatamente 2 metas, cada uma com indicador que tenha número e prazo (até o fim do mês informado). São metas sugeridas, não dados inventados.
- tom_de_voz.exemplos: exatamente 3 frases curtas no tom pedido.
- semanas: exatamente 4 semanas, cada uma com o número de posts e a ordem de dia/fase/formato da estrutura obrigatória enviada. "foco" é uma frase curta (ex.: "Fazer o público se reconhecer").
- gancho: no máximo 90 caracteres. ideia: 2 a 3 frases. cta: curto. por_que: 1 frase ligando o post ao objetivo do mês.
- stories_recorrentes: de 3 a 5 ideias de stories que se repetem toda semana.
- frases_para_apresentar: exatamente 3 frases prontas para o social media usar na reunião com o cliente.`;

function montarPedido(form: FormInput, esqueleto: Esqueleto, mes: string): string {
  const total = esqueleto.flat().length;
  const contagem = contagemFases(form.objetivo, total);
  const grupo = grupoDoNicho(form.nicho);
  const dados = {
    marca: form.cliente,
    nicho: nomeDoNicho(form),
    servico_principal: form.servico,
    cidade_ou_regiao: form.cidade || "atende online / não informado",
    objetivo_do_mes: form.objetivo,
    cliente_ideal: form.publico,
    maior_dor_ou_vontade: form.dor,
    o_que_faz_hesitar: objecoesLegiveis(form),
    formatos_aceitos: form.formatos.map((f) => FORMATOS.find((x) => x.id === f)!.nome),
    tom_de_voz: TONS.find((t) => t.id === form.tom)!.nome,
    data_ou_acao_importante: form.dataEspecial || "nenhuma",
    mes: mes,
  };
  const estrutura = esqueleto
    .map((semana, s) => `Semana ${s + 1}: ` + semana.map((p) => `${p.dia} · ${p.fase} · ${p.formato}`).join(" | "))
    .join("\n");
  const semanaData = semanaDaData(form.dataEspecial);
  const regraArea =
    grupo === "saude"
      ? "Área de saúde: sem promessa de resultado, sem antes e depois sem autorização, sem sensacionalismo."
      : grupo === "advocacia"
        ? "Advocacia: sem captação direta de clientes e sem promessa de resultado. CTAs informativos (salvar, compartilhar, tirar dúvida)."
        : "Sem regras especiais de publicidade além do bom senso.";

  return `Dados do cliente: ${JSON.stringify(dados, null, 2)}
Total de posts: ${total} · Dias: ${diasDaSemana(form.postsPorSemana).join(", ")} · Distribuição de fases: ${FASE_IDS.map((id) => `${id}=${contagem[id]}`).join(", ")}

Estrutura obrigatória (mantenha exatamente estes dias, fases e formatos, nesta ordem):
${estrutura}
${semanaData ? `\nA data/ação importante ("${form.dataEspecial}") cai na semana ${semanaData}: encaixe um post sobre ela nessa semana e diga isso no "por_que".` : ""}
${regraArea}`;
}

function opcoesDeRaciocinio(modelo: string) {
  // Sonnet 5.5: raciocínio desligado (between_tools) pra caber no prazo de 45 s.
  if (modelo.startsWith("claude-sonnet-5-5")) return { thinking: { type: "between_tools" as const } };
  return {};
}

/**
 * Gera o plano com a API da Anthropic. Devolve null (e o app usa o plano B)
 * se não houver chave, se der erro, se estourar o prazo, se a IA recusar
 * ou se o JSON não passar na validação duas vezes.
 */
export async function gerarComIA(form: FormInput, esqueleto: Esqueleto, mes: string): Promise<Plano | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const modelo = process.env.ANTHROPIC_MODEL || MODELO_PADRAO;
  const client = new Anthropic({ maxRetries: 0 });
  const prazo = Date.now() + PRAZO_TOTAL_MS;
  const pedido = montarPedido(form, esqueleto, mes);

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const restante = prazo - Date.now();
    if (restante < MINIMO_PARA_TENTAR_MS) break;
    try {
      const resposta = await client.messages.parse(
        {
          model: modelo,
          max_tokens: 8000,
          system: [{ type: "text", text: PROMPT_SISTEMA, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: pedido }],
          output_config: { format: zodOutputFormat(PlanoSchema) },
          ...opcoesDeRaciocinio(modelo),
        },
        { timeout: restante, maxRetries: 0 },
      );

      if (resposta.stop_reason === "refusal") {
        console.warn("[planejamento] IA recusou o pedido:", resposta.stop_details?.category ?? "sem categoria");
        return null;
      }
      if (resposta.stop_reason === "max_tokens") {
        console.warn(`[planejamento] Resposta cortada por max_tokens (tentativa ${tentativa})`);
        continue;
      }
      const plano = validarPlano(resposta.parsed_output, esqueleto);
      if (plano) return plano;
      console.warn(`[planejamento] JSON da IA não passou na validação (tentativa ${tentativa})`);
    } catch (erro) {
      if (erro instanceof Anthropic.AuthenticationError || erro instanceof Anthropic.PermissionDeniedError) {
        console.error("[planejamento] Chave da Anthropic inválida ou sem permissão:", erro.message);
        return null;
      }
      if (erro instanceof Anthropic.BadRequestError || erro instanceof Anthropic.NotFoundError) {
        console.error("[planejamento] Pedido recusado pela API (modelo ou parâmetros):", erro.message);
        return null;
      }
      if (erro instanceof Anthropic.RateLimitError) {
        console.warn("[planejamento] Limite de uso da API atingido:", erro.message);
        return null;
      }
      if (erro instanceof Anthropic.APIConnectionTimeoutError) {
        console.warn("[planejamento] IA passou do prazo de 45 s");
        return null;
      }
      if (erro instanceof Anthropic.APIError) {
        console.warn(`[planejamento] Erro da API ${erro.status} (tentativa ${tentativa}):`, erro.message);
        continue;
      }
      // Erro ao interpretar/validar o JSON devolvido: tenta de novo uma vez.
      console.warn(`[planejamento] Falha ao ler a resposta da IA (tentativa ${tentativa}):`, (erro as Error).message);
    }
  }
  return null;
}
