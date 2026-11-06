/**
 * Modelos do plano B (quando a IA não está configurada ou falha).
 * Variáveis entre chaves são trocadas pelas respostas do formulário:
 *   {marca} {servico} {Servico} {publico} {dor} {Dor} {cidade} {objecao}
 *   {conversao} {termo} {mes} {dataEspecial}
 * {cidade} vira " em Teresina" (com espaço) ou fica vazio.
 * Edite os textos aqui sem mexer no código.
 */

import type { FaseId } from "./fases";
import type { ObjecaoId, ObjetivoId, TomId } from "./formulario";

export type ModeloPost = { gancho: string; ideia: string; cta: string };

/** CTA alternativo para saúde e advocacia (sem captação direta nem promessa). */
export type ModeloPostRegulado = ModeloPost & { ctaRegulado?: string; ganchoSaude?: string; ideiaSaude?: string };

export const MODELOS: Record<Exclude<FaseId, "resistencia">, ModeloPostRegulado[]> = {
  identificacao: [
    {
      gancho: "{Dor} também faz parte da sua rotina?",
      ideia:
        "Mostre 3 situações do dia a dia de quem vive isso, do jeito que o público fala. Sem julgamento: a pessoa precisa pensar \"isso sou eu\". Feche dizendo que tem jeito e que você vai mostrar como.",
      cta: "Comenta \"EU\" se você se identificou",
    },
    {
      gancho: "3 sinais de que está na hora de pensar em {servico}",
      ideia:
        "Liste 3 sinais concretos de que o problema já está atrapalhando, um por cena ou por slide. Cada sinal com um exemplo real da rotina de {publico}. No fim, convide a pessoa a contar quantos sinais ela tem.",
      cta: "Quantos desses você tem? Me conta nos comentários",
    },
    {
      gancho: "Ninguém fala disso, mas {dor} pesa mais do que parece",
      ideia:
        "Fale do impacto que {dor} tem na vida de {publico}: no trabalho, nas fotos, na autoestima, no bolso, no que fizer sentido pro nicho. Tom de conversa, olhando pra câmera. Termine com uma pergunta.",
      cta: "Salva pra lembrar que você não está sozinho(a)",
    },
    {
      gancho: "Se você é {publico}{cidade}, esse post é pra você",
      ideia:
        "Chame o público pelo nome e descreva o momento que ele vive hoje, incluindo {dor}. Mostre que você entende a situação melhor do que ninguém antes de falar de qualquer serviço.",
      cta: "Marca alguém que precisa ver isso",
    },
  ],
  solucao: [
    {
      gancho: "Como funciona {servico}, passo a passo",
      ideia:
        "Explique as etapas de {servico} de forma simples: o que acontece antes, durante e depois. Um passo por slide, com linguagem que {publico} entende. Termine com o que a pessoa precisa fazer pra começar.",
      cta: "Salva pra consultar depois",
    },
    {
      gancho: "{Servico}: o que é mito e o que é verdade",
      ideia:
        "Pegue as 3 crenças mais comuns sobre {servico} e responda cada uma com \"mito\" ou \"verdade\" e uma explicação curta. Use dúvidas reais que o cliente costuma ouvir.",
      cta: "Qual desses você achava que era verdade?",
      ctaRegulado: "Salva e compartilha com quem tem essa dúvida",
    },
    {
      gancho: "O que muda na sua rotina com {servico}",
      ideia:
        "Mostre, de forma concreta, como {servico} ajuda a resolver {dor}. Foque na experiência e no dia a dia, não em promessa. Feche explicando o primeiro passo.",
      cta: "Quer entender se é pra você? Chama no direct",
      ganchoSaude: "O que esperar de {servico}, sem promessa milagrosa",
      ideiaSaude:
        "Explique com honestidade o que {servico} pode fazer, quais cuidados envolve e por que cada caso é avaliado individualmente. Sem promessa de resultado. Feche explicando como é a primeira avaliação.",
      ctaRegulado: "Salva e manda pra quem tem essa dúvida",
    },
    {
      gancho: "Pra quem {servico} é indicado (e pra quem não é)",
      ideia:
        "Separe em duas colunas: quem se beneficia de {servico} e quem deveria buscar outra opção. Honestidade gera confiança e filtra quem realmente tem perfil.",
      cta: "Você se encaixa? Me conta nos comentários",
    },
  ],
  autoridade: [
    {
      gancho: "Um dia nos bastidores da {marca}",
      ideia:
        "Mostre a rotina real: a preparação, a equipe, os detalhes que o cliente não vê. Cortes rápidos com uma narração curta explicando o cuidado por trás de cada etapa.",
      cta: "Quer ver mais bastidores? Segue o perfil",
    },
    {
      gancho: "Por que a gente faz {servico} desse jeito",
      ideia:
        "Explique o método ou o protocolo da {marca} e o motivo de cada escolha. Mostre que existe um processo pensado, não um serviço feito no automático.",
      cta: "Salva pra lembrar o que perguntar antes de fechar",
    },
    {
      gancho: "Quem está por trás da {marca}",
      ideia:
        "Conte a história de quem faz: formação, quanto tempo de experiência, por que escolheu essa área. Uma história curta, verdadeira, olhando pra câmera.",
      cta: "Comenta um \"oi\" pra gente se conhecer",
    },
    {
      gancho: "A pergunta que mais recebo sobre {servico}",
      ideia:
        "Responda a dúvida mais frequente do público com segurança e clareza. Mostre domínio do assunto sem complicar, como quem explica pra um amigo.",
      cta: "Manda a sua dúvida que eu respondo no próximo",
    },
  ],
  prova_social: [
    {
      gancho: "O que quem já fez {servico} conta pra gente",
      ideia:
        "Depoimento em vídeo de um {termo} real, gravado com autorização, contando como foi a experiência do início ao fim. Não roteirize a fala: deixe a pessoa contar do jeito dela.",
      cta: "Quer viver essa experiência também? Chama no direct",
      ctaRegulado: "Salva pra lembrar quando precisar",
    },
    {
      gancho: "Mensagem que recebemos essa semana 💬",
      ideia:
        "Print de uma mensagem ou avaliação real de um {termo}, com autorização e nome borrado se for o caso. Comente em uma frase o que aquela mensagem significa pra equipe.",
      cta: "Já é {termo}? Conta como foi nos comentários",
    },
    {
      gancho: "Pergunta pra quem já passou por aqui",
      ideia:
        "Junte avaliações reais do Google ou do direct (com autorização) que respondem a objeção de {objecao}. Uma avaliação por slide, com destaque na frase principal.",
      cta: "Salva e manda pra quem está em dúvida",
    },
    {
      gancho: "Antes e depois real, com autorização",
      ideia:
        "Mostre um caso real, com autorização por escrito do {termo}, explicando o que foi feito e o tempo envolvido. Deixe claro que cada caso é único.",
      cta: "Quer saber se dá pra você? Chama no direct",
      ganchoSaude: "Um caso real explicado, com autorização e sem promessa",
      ideiaSaude:
        "Com autorização por escrito do paciente, explique um caso: qual era a queixa, o que foi feito e quais cuidados vieram depois. Deixe claro que cada caso é avaliado individualmente e que resultados variam.",
      ctaRegulado: "Salva pra conversar com seu profissional",
    },
  ],
  recompensa: [
    {
      gancho: "Obrigado por confiar na {marca} 💜",
      ideia:
        "Post de agradecimento aos clientes do mês, com fotos ou nomes de quem autorizou. Mostre que cada pessoa importa e que a {marca} é feita por elas.",
      cta: "Já é cliente? Marca a gente nos stories",
    },
    {
      gancho: "Um mimo pra quem já é da casa",
      ideia:
        "Apresente um benefício simples pra quem já é cliente ou indica alguém: atendimento prioritário, brinde, condição especial. Explique como funciona em uma frase.",
      cta: "Marca aqui quem você indicaria",
      ganchoSaude: "Você faz parte da nossa história",
      ideiaSaude:
        "Post de carinho com quem já é {termo}: bastidores de um atendimento, um agradecimento da equipe e um convite pra contar como foi a experiência. Sem sorteio nem promoção.",
      ctaRegulado: "Conta pra gente como foi a sua experiência",
    },
    {
      gancho: "{Termo} do mês: uma homenagem 🏅",
      ideia:
        "Homenageie um {termo} (com autorização) contando um pouco da história dele com a {marca}. Faz quem já é cliente se sentir parte e dá vontade em quem ainda não é.",
      cta: "Quer aparecer aqui no próximo mês? Conta sua história",
    },
  ],
};

/** Resistência: modelos por objeção. */
export const MODELOS_RESISTENCIA: Record<ObjecaoId | "outro", ModeloPostRegulado[]> = {
  preco: [
    {
      gancho: "{Servico} é caro? Vamos falar de valor",
      ideia:
        "Explique o que está incluso, o que diferencia um serviço bem feito e quanto custa adiar a decisão. Sem citar preço: mostre por que o valor faz sentido e quais as formas de pagamento.",
      cta: "Manda \"VALOR\" no direct pra saber as condições",
      ctaRegulado: "Tire suas dúvidas pelo link da bio",
    },
    {
      gancho: "O barato que sai caro em {servico}",
      ideia:
        "Mostre os riscos de escolher só pelo menor preço: retrabalho, falta de cuidado, resultado que não dura. Termine explicando o que a {marca} faz diferente.",
      cta: "Salva pra lembrar na hora de escolher",
    },
  ],
  medo: [
    {
      gancho: "Dói? Tem risco? Respondendo sem rodeio",
      ideia:
        "Responda as 3 perguntas mais comuns de quem tem medo de {servico}, com calma e transparência. Mostre os cuidados que a {marca} toma em cada etapa.",
      cta: "Qual é o seu maior medo? Responde nos comentários",
    },
    {
      gancho: "O que ninguém te conta antes de {servico}",
      ideia:
        "Tire o medo do desconhecido: mostre exatamente o que acontece, do agendamento ao pós. Quanto mais previsível, menos assustador.",
      cta: "Salva pra ver antes de marcar",
    },
  ],
  tempo: [
    {
      gancho: "Quanto tempo leva {servico} na prática",
      ideia:
        "Mostre o tempo real de cada etapa e como a {marca} organiza a agenda pra caber na rotina de {publico}. Dê exemplos de horários e formatos possíveis.",
      cta: "Pergunta no direct qual horário funciona pra você",
      ctaRegulado: "Salva pra se organizar",
    },
    {
      gancho: "Sem tempo? Esse post é pra você",
      ideia:
        "Fale direto com quem acha que não tem tempo: o que dá pra resolver em pouco tempo, o que exige mais e como planejar. Prático e realista.",
      cta: "Marca alguém que vive sem tempo",
    },
  ],
  confianca: [
    {
      gancho: "5 perguntas pra fazer antes de fechar {servico}",
      ideia:
        "Ensine o público a escolher bem: o que perguntar, o que observar, o que é sinal de alerta. Respondendo, a {marca} mostra que não tem nada a esconder.",
      cta: "Salva e usa antes de escolher qualquer lugar",
    },
    {
      gancho: "Como saber se você está em boas mãos",
      ideia:
        "Mostre os sinais de um serviço sério: formação, estrutura, transparência, acompanhamento. Use exemplos reais da rotina da {marca}.",
      cta: "Ficou com alguma dúvida? Pergunta aqui",
    },
  ],
  nao_precisa: [
    {
      gancho: "\"Eu não preciso de {servico}\". Será mesmo?",
      ideia:
        "Mostre situações em que a pessoa acha que está tudo bem, mas {dor} já está aparecendo. Sem susto e sem exagero: informação pra ela decidir com consciência.",
      cta: "Comenta se você já pensou assim",
    },
    {
      gancho: "O que acontece quando a gente adia {servico}",
      ideia:
        "Explique, de forma honesta, o que costuma acontecer quando a decisão fica pra depois. Termine com um primeiro passo simples.",
      cta: "Salva pra não deixar pra depois",
    },
  ],
  experiencia_ruim: [
    {
      gancho: "Já teve uma experiência ruim com {servico}?",
      ideia:
        "Acolha quem já se frustrou: reconheça que acontece e mostre, com fatos, o que a {marca} faz diferente pra não repetir aquilo.",
      cta: "Conta o que aconteceu, a gente responde com carinho",
    },
    {
      gancho: "O que a gente faz pra você não passar por isso de novo",
      ideia:
        "Mostre os cuidados e garantias de processo da {marca}: avaliação, acompanhamento, canal aberto pra dúvidas. Sem prometer resultado.",
      cta: "Salva pra lembrar do que exigir",
    },
  ],
  outro: [
    {
      gancho: "Sobre \"{objecao}\": a resposta direta",
      ideia:
        "Pegue essa dúvida que faz o público hesitar e responda sem rodeio, com exemplos reais da rotina da {marca}. Termine com o próximo passo.",
      cta: "Ficou alguma dúvida? Manda no direct",
      ctaRegulado: "Salva e compartilha com quem tem essa dúvida",
    },
  ],
};

/** Post da data especial informada. */
export const MODELO_DATA_ESPECIAL: ModeloPost = {
  gancho: "Marca na agenda: {dataEspecial}",
  ideia:
    "Anuncie a ação com clareza: o que é, quando acontece e como participar. Use os stories da semana pra lembrar e criar expectativa.",
  cta: "Ativa o lembrete nos stories",
};

/** Foco da semana pela fase que mais aparece nela. */
export const FOCO_POR_FASE: Record<FaseId, string> = {
  identificacao: "Fazer o público se reconhecer",
  solucao: "Mostrar que existe saída",
  resistencia: "Derrubar as objeções",
  autoridade: "Mostrar quem está por trás",
  prova_social: "Deixar os clientes falarem",
  recompensa: "Valorizar quem já é cliente",
};

/** "Por que esse post existe", por fase. */
export const POR_QUE_POR_FASE: Record<FaseId, string> = {
  identificacao: "Faz o público se reconhecer no problema, que é o primeiro passo pra {resultado}.",
  solucao: "Mostra que existe saída pra {dor} e apresenta {servico} como o caminho.",
  resistencia: "Derruba a objeção de {objecao}, que hoje trava a decisão de quem já está interessado.",
  autoridade: "Mostra o cuidado e o processo da {marca}, pra que ela seja lembrada como referência.",
  prova_social: "Deixa outras pessoas confirmarem o valor de {servico}, o que pesa mais do que qualquer argumento da marca.",
  recompensa: "Faz quem já é cliente se sentir especial e com vontade de indicar, o que alimenta o próximo mês.",
};

/** Objetivo do mês: posição e resultado por objetivo. */
export const OBJETIVO_TEXTO: Record<ObjetivoId, { posicao: string; resultado: string; curto: string }> = {
  conhecido: {
    posicao: "a primeira lembrança quando o assunto é {servico}",
    resultado: "mais gente conhecendo e seguindo o perfil",
    curto: "fazer {marca} ficar mais conhecida",
  },
  autoridade: {
    posicao: "referência em {servico}",
    resultado: "mais confiança e procura espontânea",
    curto: "posicionar {marca} como referência",
  },
  vender: {
    posicao: "a escolha mais segura para {servico}",
    resultado: "mais {conversao} pelo Instagram",
    curto: "gerar mais {conversao}",
  },
  lancar: {
    posicao: "a melhor opção de {servico}, que acabou de chegar",
    resultado: "os primeiros clientes do lançamento",
    curto: "lançar {servico} com força",
  },
  seguidores: {
    posicao: "um perfil que vale a pena seguir sobre {servico}",
    resultado: "mais seguidores que têm a ver com o negócio",
    curto: "atrair seguidores que têm a ver com o negócio",
  },
};

/** Metas com número e prazo (sugestões; o social media ajusta à realidade do cliente). */
export const METAS: Record<ObjetivoId, { meta: string; indicador: string }[]> = {
  conhecido: [
    { meta: "Aumentar o alcance do perfil", indicador: "+30% de contas alcançadas em relação ao mês anterior, até o fim de {mes}" },
    { meta: "Gerar compartilhamentos", indicador: "Pelo menos 20 compartilhamentos somados nos Reels do mês, até o fim de {mes}" },
  ],
  autoridade: [
    { meta: "Aumentar os salvamentos", indicador: "+25% de salvamentos nos carrosséis em relação ao mês anterior, até o fim de {mes}" },
    { meta: "Receber dúvidas do público", indicador: "Pelo menos 15 perguntas sobre {servico} no direct ou na caixinha, até o fim de {mes}" },
  ],
  vender: [
    { meta: "Aumentar {conversao} vindos do Instagram", indicador: "+20% de {conversao} com origem no Instagram em relação ao mês anterior, até o fim de {mes}" },
    { meta: "Gerar conversas no direct", indicador: "Pelo menos 30 conversas iniciadas pelos CTAs dos posts, até o fim de {mes}" },
  ],
  lancar: [
    { meta: "Apresentar o lançamento", indicador: "Pelo menos 50 pessoas pedindo informações sobre {servico}, até o fim de {mes}" },
    { meta: "Fechar os primeiros clientes", indicador: "Os 10 primeiros clientes de {servico}, até o fim de {mes}" },
  ],
  seguidores: [
    { meta: "Ganhar seguidores qualificados", indicador: "+15% de seguidores em relação ao início do mês, até o fim de {mes}" },
    { meta: "Converter visitas em seguidores", indicador: "Pelo menos 10% das visitas ao perfil virando seguidores, até o fim de {mes}" },
  ],
};

/** Objeção principal, explicada. */
export const OBJECAO_TEXTO: Record<ObjecaoId, string> = {
  preco: "Acha que {servico} é caro ou que não cabe no orçamento agora.",
  medo: "Tem medo de como vai ser (dor, risco, resultado) e insegurança pra dar o primeiro passo.",
  tempo: "Acha que não tem tempo pra encaixar {servico} na rotina.",
  confianca: "Ainda não confia o suficiente na {marca} pra fechar.",
  nao_precisa: "Acha que ainda não precisa de {servico}.",
  experiencia_ruim: "Já teve uma experiência ruim antes e tem receio de passar por isso de novo.",
};

export const OBJECAO_CURTA: Record<ObjecaoId, string> = {
  preco: "preço",
  medo: "medo",
  tempo: "falta de tempo",
  confianca: "falta de confiança",
  nao_precisa: "achar que não precisa",
  experiencia_ruim: "experiência ruim",
};

/** Tom de voz: descrição e 3 exemplos. */
export const TOM_TEXTO: Record<TomId, { descricao: string; exemplos: string[] }> = {
  profissional: {
    descricao: "Claro, seguro e respeitoso. Frases completas, sem gírias, explicando o porquê das coisas.",
    exemplos: [
      "Antes de indicar {servico}, avaliamos cada caso com cuidado.",
      "Transparência faz parte do nosso atendimento: tire suas dúvidas antes de decidir.",
      "Qualidade não é detalhe. É o padrão da {marca}.",
    ],
  },
  acolhedor: {
    descricao: "Próximo, gentil e sem julgamento. Fala como quem conversa com um amigo.",
    exemplos: [
      "Tá tudo bem ter dúvida. A gente explica com calma.",
      "Aqui você é chamado(a) pelo nome, não pelo número da ficha.",
      "Seu tempo e seu bem-estar vêm primeiro.",
    ],
  },
  divertido: {
    descricao: "Leve, bem-humorado e direto. Usa situações do dia a dia e emojis com moderação.",
    exemplos: [
      "Spoiler: {servico} não é esse bicho de sete cabeças 😅",
      "Se você se identificou, marca aquele amigo que também precisa ver isso.",
      "Sem enrolação e sem letra miúda. Prometido.",
    ],
  },
  didatico: {
    descricao: "Explica com clareza e passo a passo, usando termos técnicos só quando precisa, e sempre traduzidos.",
    exemplos: [
      "Em 3 passos: como funciona {servico} na prática.",
      "Termo do dia: o que significa e por que importa pra você.",
      "Antes de decidir, entenda os prós, os contras e os cuidados.",
    ],
  },
};

/** Stories recorrentes. */
export const STORIES = [
  "Segunda: caixinha de dúvidas sobre {servico}, com as melhores respostas no dia seguinte",
  "Bastidor do dia: um momento real da rotina da {marca}",
  "Enquete rápida sobre {dor} pra entender melhor o público",
  "Sexta: repost de quem marcou a {marca} (com autorização)",
];

export const STORY_VENDA = "Lembrete com link direto pro WhatsApp ou pra agenda, depois de cada post de prova social";

/** Frases para o social media usar na reunião. */
export const FRASES_APRESENTAR = [
  "Esse mês, o foco é {objetivoCurto}. Por isso, cada post tem uma função clara: atrair, gerar confiança, quebrar objeção ou vender.",
  "Nas primeiras semanas, o público se reconhece no problema. Nas últimas, a gente mostra prova e derruba a objeção de {objecao}.",
  "No fim do mês, a gente compara os números com a meta ({indicador}) pra saber se o plano funcionou e ajustar o próximo.",
];

/** Como chamar a conversão em cada nicho. */
export const CONVERSAO_POR_NICHO: Record<string, string> = {
  odontologia: "agendamentos",
  estetica: "agendamentos",
  medico: "agendamentos",
  psicologo: "agendamentos",
  nutricionista: "agendamentos",
  advogado: "consultas agendadas",
  loja_roupas: "vendas",
  restaurante: "pedidos",
  academia: "matrículas",
  salao: "agendamentos",
  imobiliaria: "visitas agendadas",
  contabilidade: "contatos de clientes interessados",
  escola: "matrículas",
  pet: "agendamentos",
  infoprodutor: "vendas",
  outro: "contatos de clientes interessados",
};

/** Como chamar quem compra, em cada grupo de nicho. */
export const TERMO_CLIENTE: Record<"saude" | "advocacia" | "geral", string> = {
  saude: "paciente",
  advocacia: "cliente",
  geral: "cliente",
};
