/**
 * Raio-X do Social Media — todos os textos e dados do teste.
 * Edite os textos aqui sem precisar mexer nos componentes.
 *
 * Regras:
 * - `points` (0 a 3) é usado só no cálculo e NUNCA aparece na tela.
 * - A ordem das áreas e das perguntas é mantida; a ordem das opções
 *   é embaralhada para cada pessoa.
 */

export type AreaId =
  | "objetivo"
  | "diagnostico"
  | "concorrentes"
  | "conteudo"
  | "apresentacao"
  | "valor";

export type Option = { text: string; points: 0 | 1 | 2 | 3 };

export type Question = {
  id: number; // 1..12
  area: AreaId;
  text: string;
  options: [Option, Option, Option, Option];
  /** Como um estrategista faz. Aparece no diagnóstico quando a resposta não foi a de 3 pontos. */
  tip: string;
};

export type Area = {
  id: AreaId;
  number: string; // "01"
  name: string; // nome completo
  shortName: string; // usado no gráfico radar
  emoji: string;
  /** Palavra da tela "área concluída" (concordância: concluído/concluída/concluídos). */
  doneWord: string;
  /** Frase curta e neutra da tela "área concluída". */
  doneText: string;
  /** Texto do card "Seu principal gargalo" e do plano de ação. */
  bottleneck: { diagnosis: string; firstStep: string };
  /** Análise da área no diagnóstico completo, conforme a faixa da nota. */
  analysis: Record<BandId, string>;
};

export type LevelId = "fazedor" | "executor" | "construcao" | "estrategista";

export type Level = {
  id: LevelId;
  min: number;
  max: number;
  name: string;
  emoji: string;
  description: string;
  /** Parágrafo "O que isso significa". */
  meaning: string;
};

export type BandId = "critico" | "fragil" | "desenvolvimento" | "avancado";

export type Band = { id: BandId; min: number; max: number; name: string };

/* ------------------------------------------------------------------ */
/* Áreas                                                               */
/* ------------------------------------------------------------------ */

export const AREAS: Area[] = [
  {
    id: "objetivo",
    number: "01",
    name: "Objetivo",
    doneWord: "concluído",
    shortName: "Objetivo",
    emoji: "🎯",
    doneText: "Primeira área analisada. Bora pra próxima.",
    bottleneck: {
      diagnosis:
        "Você começa a criar sem saber exatamente onde o cliente quer chegar. Quando qualquer post serve, nenhum funciona, e o cliente não tem como perceber o seu valor.",
      firstStep:
        "Antes do próximo calendário, escreva em uma frase o que o cliente quer que aconteça no negócio dele, e transforme isso em 2 metas com número e prazo.",
    },
    analysis: {
      critico:
        "Hoje o trabalho começa sem um destino claro. Sem objetivo definido, você não tem como provar que está dando certo, e o cliente passa a julgar seu trabalho só pela estética e pelos likes.",
      fragil:
        "Você até conversa sobre objetivo, mas ele ainda é vago, do tipo 'crescer' ou 'vender mais'. Sem número e prazo, fica difícil mostrar evolução e defender suas escolhas.",
      desenvolvimento:
        "Você já começa pelo objetivo na maior parte das vezes. O próximo passo é deixar isso escrito, com número e prazo, e usar como régua em toda conversa com o cliente.",
      avancado:
        "Você define onde o cliente quer chegar antes de criar. Isso te dá argumento pra dizer não, priorizar e provar resultado. Mantém esse padrão com todo cliente novo.",
    },
  },
  {
    id: "diagnostico",
    number: "02",
    name: "Diagnóstico",
    doneWord: "concluído",
    shortName: "Diagnóstico",
    emoji: "🔍",
    doneText: "Duas de seis. Você tá indo bem rápido.",
    bottleneck: {
      diagnosis:
        "Você cria conteúdo sem olhar com calma para o perfil e o público como estão hoje. É como receitar remédio sem examinar o paciente.",
      firstStep:
        "Faça uma análise rápida do perfil do cliente: o que funciona, o que não funciona, quem é o público e qual a maior dor dele.",
    },
    analysis: {
      critico:
        "Você está criando no escuro: sem olhar o perfil, o público e os números, cada post é um chute. E chute não se defende numa reunião.",
      fragil:
        "Você conhece o básico do público e olha os números de vez em quando, mas isso ainda não muda o que você planeja. Os dados existem, só não viram decisão.",
      desenvolvimento:
        "Você já analisa o perfil e conhece o público. Falta transformar essa análise num documento que o cliente veja e numa rotina de ajuste mês a mês.",
      avancado:
        "Você conhece o público a fundo e usa os números pra decidir. Suas escolhas têm motivo e você consegue explicar cada uma.",
    },
  },
  {
    id: "concorrentes",
    number: "03",
    name: "Concorrentes",
    doneWord: "concluídos",
    shortName: "Concorrentes",
    emoji: "👀",
    doneText: "Metade do caminho. Segue firme.",
    bottleneck: {
      diagnosis:
        "Você não sabe com clareza onde o seu cliente pode se destacar dos concorrentes. Sem isso, o conteúdo fica parecido com o de todo mundo.",
      firstStep:
        "Escolha 3 concorrentes do seu cliente e anote o que cada um faz bem e o que não faz. O que ninguém faz é o espaço do seu cliente.",
    },
    analysis: {
      critico:
        "Sem olhar a concorrência, o conteúdo do seu cliente tende a ficar igual ao de todo mundo do nicho. E quem é igual disputa só no preço.",
      fragil:
        "Você olha os concorrentes, mas mais pra se inspirar do que pra encontrar espaço. Copiar o que funciona pros outros raramente faz o seu cliente ser lembrado.",
      desenvolvimento:
        "Você já sabe o que diferencia seu cliente. Agora é usar isso de forma consistente no conteúdo, pra que o público perceba a diferença sem precisar de explicação.",
      avancado:
        "Você enxerga o que os concorrentes não fazem e usa isso pra posicionar o seu cliente. É assim que uma marca deixa de ser 'mais uma'.",
    },
  },
  {
    id: "conteudo",
    number: "04",
    name: "Conteúdo",
    doneWord: "concluído",
    shortName: "Conteúdo",
    emoji: "✍️",
    doneText: "Quatro de seis. Falta pouco.",
    bottleneck: {
      diagnosis:
        "Seus posts até ficam bonitos, mas nem sempre têm um papel claro. Sem esse papel, fica difícil levar o público de 'nunca ouvi falar' até 'quero comprar'.",
      firstStep:
        "No próximo calendário, escreva ao lado de cada post para que ele serve: atrair, gerar autoridade, quebrar objeção ou vender.",
    },
    analysis: {
      critico:
        "O conteúdo hoje nasce da inspiração do dia ou da trend do momento. Sem um papel pra cada post, o feed até movimenta, mas não leva ninguém até a compra.",
      fragil:
        "Você tem um calendário, mas ele é guiado por datas e temas soltos. Falta conectar cada post a um objetivo e a uma etapa da jornada do público.",
      desenvolvimento:
        "Boa parte dos seus posts já tem um porquê. O próximo passo é distribuir o mês pensando na jornada completa: atrair, gerar confiança, quebrar objeção e vender.",
      avancado:
        "Cada post tem uma função clara no plano. Você responde 'por que esse post?' sem hesitar, e isso muda como o cliente enxerga seu trabalho.",
    },
  },
  {
    id: "apresentacao",
    number: "05",
    name: "Apresentação",
    doneWord: "concluída",
    shortName: "Apresentação",
    emoji: "🗣️",
    doneText: "Só mais uma área. Reta final.",
    bottleneck: {
      diagnosis:
        "Você faz um trabalho estratégico, mas o cliente não vê. Se ele só recebe o post pronto, é natural achar que seu trabalho é 'só postar'.",
      firstStep:
        "No próximo mês, apresente ao cliente o plano antes dos posts: o objetivo, o que vai ser feito e por quê. Nem que seja numa chamada de 15 minutos.",
    },
    analysis: {
      critico:
        "O cliente só vê o post pronto chegando no WhatsApp. Pra ele, seu trabalho é 'postar', e é natural que ele te compare com qualquer pessoa que posta.",
      fragil:
        "Você entrega organizado, mas sem explicar o raciocínio. O cliente vê o calendário, não vê a estratégia, e por isso não percebe o quanto você pensa antes de criar.",
      desenvolvimento:
        "Você já mostra parte do planejamento. Falta um ritual fixo, uma apresentação mensal com objetivo, plano e resultado, pra que o cliente acompanhe o processo inteiro.",
      avancado:
        "O cliente enxerga o plano, o porquê e o resultado. É isso que faz ele te ver como estrategista e defender o seu trabalho pra outras pessoas.",
    },
  },
  {
    id: "valor",
    number: "06",
    name: "Valor e preço",
    doneWord: "concluído",
    shortName: "Valor",
    emoji: "💰",
    doneText: "Última área analisada. Seu diagnóstico tá pronto.",
    bottleneck: {
      diagnosis:
        "Você cobra pela quantidade de posts, não pelo que entrega. Assim, o cliente compara o seu trabalho com o de qualquer pessoa que posta mais barato.",
      firstStep:
        "Liste tudo o que você faz além de criar posts (análise, estratégia, relatório, reunião) e comece a mostrar isso na sua proposta.",
    },
    analysis: {
      critico:
        "Seu preço hoje depende do bolso do cliente ou da quantidade de posts. Assim, qualquer pessoa que poste mais barato vira ameaça, e desconto vira rotina.",
      fragil:
        "Você já tem uma lógica de preço, mas ela ainda gira em torno de entregáveis (posts e stories). O cliente compra quantidade, não resultado.",
      desenvolvimento:
        "Sua proposta já mostra os serviços inclusos. O próximo passo é mostrar o processo e o que o cliente ganha com ele, pra que o valor fique claro antes do preço.",
      avancado:
        "Você cobra pelo que entrega e mostra isso na proposta. Isso te tira da briga por preço e abre espaço pra aumentar seu ticket com segurança.",
    },
  },
];

/** Ordem de desempate do principal gargalo (menor nota). */
export const BOTTLENECK_PRIORITY: AreaId[] = [
  "objetivo",
  "apresentacao",
  "diagnostico",
  "conteudo",
  "valor",
  "concorrentes",
];

/** Frase do card "Sua área mais forte". `{AREA}` é trocado pelo nome. */
export const STRONGEST_TEXT =
  "Ponto forte: {AREA}. Isso já te coloca à frente de muita gente. Use como base para fortalecer o resto.";

/* ------------------------------------------------------------------ */
/* Níveis (nota geral) e faixas (nota por área)                        */
/* ------------------------------------------------------------------ */

export const LEVELS: Level[] = [
  {
    id: "fazedor",
    min: 0,
    max: 39,
    name: "Fazedor de post",
    emoji: "😬",
    description:
      "Hoje, o cliente provavelmente enxerga seu trabalho como 'fazer posts'. Não é falta de talento: é falta de mostrar o que existe por trás de cada entrega.",
    meaning:
      "Na prática, isso deixa você na pior posição possível: brigando por preço com qualquer pessoa que posta. A boa notícia? Dá pra mudar rápido. Começa pelo seu principal gargalo, um passo de cada vez, e o cliente vai perceber a diferença já no próximo mês.",
  },
  {
    id: "executor",
    min: 40,
    max: 59,
    name: "Executor esforçado",
    emoji: "💪",
    description:
      "Você entrega bastante, mas boa parte da estratégia fica só na sua cabeça. O cliente vê o resultado do esforço, mas não vê o plano.",
    meaning:
      "Você já faz mais do que o cliente imagina. O problema é que ele não sabe disso. Enquanto o plano não aparecer, seu trabalho vai continuar parecendo 'só posts'. Colocar a estratégia no papel e mostrar pro cliente é o que muda o jogo.",
  },
  {
    id: "construcao",
    min: 60,
    max: 79,
    name: "Estrategista em construção",
    emoji: "🚀",
    description:
      "Você já pensa estrategicamente em várias partes do trabalho. Falta transformar isso em um processo que o cliente consiga enxergar do início ao fim.",
    meaning:
      "Você tá no caminho certo e acima da média. Agora o desafio é consistência: fazer isso com todo cliente, todo mês, do mesmo jeito. Quando vira processo, fica mais fácil cobrar mais e o cliente para de questionar seu valor.",
  },
  {
    id: "estrategista",
    min: 80,
    max: 100,
    name: "Estrategista de verdade",
    emoji: "🎯",
    description:
      "Seu cliente tem motivos de sobra para te ver como estrategista. O próximo passo é escalar isso sem perder qualidade.",
    meaning:
      "Pouca gente chega aqui. Você planeja, mostra e mede. O próximo nível é escalar: atender mais clientes, ou clientes maiores, sem perder a qualidade. Fortalece o seu ponto mais fraco e transforma o seu jeito de trabalhar em método.",
  },
];

export const BANDS: Band[] = [
  { id: "critico", min: 0, max: 39, name: "Crítico" },
  { id: "fragil", min: 40, max: 59, name: "Frágil" },
  { id: "desenvolvimento", min: 60, max: 79, name: "Em desenvolvimento" },
  { id: "avancado", min: 80, max: 100, name: "Avançado" },
];

/* ------------------------------------------------------------------ */
/* Banco de perguntas (12: 2 por área)                                             */
/* ------------------------------------------------------------------ */

const q = (
  id: number,
  area: AreaId,
  text: string,
  o: [string, string, string, string],
  tip: string,
): Question => ({
  id,
  area,
  text,
  tip,
  options: [
    { text: o[0], points: 0 },
    { text: o[1], points: 1 },
    { text: o[2], points: 2 },
    { text: o[3], points: 3 },
  ],
});

export const QUESTIONS: Question[] = [
  // 01 · Objetivo
  q(1, "objetivo", "Quando você pega um cliente novo, o que acontece primeiro?", [
    "Já começo a criar os posts pra não perder tempo.",
    "Pergunto o nicho e o que ele gosta, e já parto pro conteúdo.",
    "Faço um briefing com algumas perguntas sobre o negócio.",
    "Faço um briefing completo e só crio depois de definir o objetivo com ele.",
  ],
    "Estrategista não cria nada antes de um briefing completo e de um objetivo combinado com o cliente. É isso que guia todo o resto.",
  ),
  q(2, "objetivo", "Se eu perguntar agora qual é o objetivo do seu principal cliente no Instagram, você responde…", [
    "\"Crescer e engajar\", acho.",
    "Ter mais seguidores e aparecer mais.",
    "Vender mais / atrair mais clientes.",
    "Uma meta clara, com número e prazo (ex.: 20 agendamentos pelo direct por mês).",
  ],
    "O objetivo precisa caber numa frase com número e prazo. Ex.: 20 agendamentos pelo direct por mês até março.",
  ),
  // 02 · Diagnóstico
  q(3, "diagnostico", "Você sabe dizer quem é o público do seu cliente, além de idade e gênero?", [
    "Não muito, é \"todo mundo que pode comprar\".",
    "Sei a faixa de idade e a cidade.",
    "Sei mais ou menos as dores e os desejos dele.",
    "Sei a dor, o desejo, as objeções e o que faz ele decidir comprar.",
  ],
    "Vá além de idade e cidade: anote a dor, o desejo, as objeções e o que faz esse público decidir comprar. É daí que saem os melhores conteúdos.",
  ),
  q(4, "diagnostico", "Com que frequência você olha os números do perfil do cliente?", [
    "Quase nunca.",
    "Quando o cliente pergunta.",
    "Uma vez por mês, mais por obrigação.",
    "Toda semana ou todo mês, e uso isso pra ajustar o que vou postar.",
  ],
    "Olhe os números com frequência fixa (semanal ou mensal) e anote o que vai mudar no próximo planejamento por causa deles.",
  ),
  // 03 · Concorrentes
  q(5, "concorrentes", "Quando você olha um concorrente, o que você procura?", [
    "Ideias pra copiar.",
    "O que está bombando pra fazer igual.",
    "O que eles fazem bem.",
    "O que eles NÃO fazem, pra achar o espaço do meu cliente.",
  ],
    "Ao analisar um concorrente, procure o que ele NÃO faz ou faz mal. Esse buraco é o espaço onde o seu cliente pode se destacar.",
  ),
  q(6, "concorrentes", "Você consegue explicar em uma frase o que diferencia o seu cliente dos concorrentes?", [
    "Não.",
    "Mais ou menos: \"ele é melhor/mais caprichado\".",
    "Consigo, mas não uso isso no conteúdo.",
    "Consigo, e isso guia o conteúdo dele.",
  ],
    "Escreva o diferencial do cliente em uma frase e use essa frase como filtro: todo conteúdo precisa reforçar essa diferença.",
  ),
  // 04 · Conteúdo
  q(7, "conteudo", "Como você decide o que postar no mês?", [
    "Na hora, conforme vou tendo ideia.",
    "Pelas datas comemorativas e trends.",
    "Monto um calendário com temas variados.",
    "A partir do objetivo e do diagnóstico, cada post tem um papel.",
  ],
    "Monte o mês a partir do objetivo e do diagnóstico, não das datas comemorativas. Data e trend entram só quando servem ao plano.",
  ),
  q(8, "conteudo", "Se o cliente perguntar \"por que esse post?\", você responde…", [
    "\"Porque estava em alta.\"",
    "\"Porque fica bonito no feed.\"",
    "\"Porque o público gosta desse tipo de conteúdo.\"",
    "\"Porque ele cumpre essa função no plano do mês\" (ex.: quebrar a objeção de preço).",
  ],
    "Tenha sempre a resposta pronta: 'esse post serve pra X no plano do mês'. Atrair, gerar autoridade, quebrar objeção ou vender.",
  ),
  // 05 · Apresentação
  q(9, "apresentacao", "Como o cliente recebe o seu trabalho todo mês?", [
    "Mando os posts pelo WhatsApp pra aprovar.",
    "Mando o feed montado pra ele ver.",
    "Mando um calendário com as legendas.",
    "Apresento um planejamento, explicando o objetivo e o porquê de cada conteúdo.",
  ],
    "Antes de mandar os posts, apresente o planejamento: o objetivo do mês, o que vai ser feito e por quê. Nem que seja numa chamada de 15 minutos.",
  ),
  q(10, "apresentacao", "Se o seu cliente fosse explicar para um amigo o que você faz, ele diria…", [
    "\"Ela posta no meu Instagram.\"",
    "\"Ela cuida das minhas redes.\"",
    "\"Ela cria o conteúdo e acompanha os números.\"",
    "\"Ela planeja a estratégia do meu Instagram pra trazer resultado.\"",
  ],
    "O jeito como o cliente te descreve é consequência do que ele vê. Mostre estratégia, relatório e próximos passos, e ele vai passar a dizer que você planeja a estratégia do Instagram dele.",
  ),
  // 06 · Valor e preço
  q(11, "valor", "Como você define o preço que cobra do cliente?", [
    "Cobro o que o cliente pode pagar.",
    "Pelo que os outros cobram na minha cidade.",
    "Pela quantidade de posts.",
    "Pelo que entrego (estratégia, análise, conteúdo, relatório) e pelo resultado.",
  ],
    "Precifique pelo que você entrega de verdade (análise, estratégia, conteúdo, relatório) e pelo resultado esperado, não pelo número de posts.",
  ),
  q(12, "valor", "Na sua proposta, o que o cliente enxerga?", [
    "Só o valor e a quantidade de posts.",
    "Os posts e os stories por semana.",
    "Os serviços e o que está incluso.",
    "O processo completo, o que ele ganha com isso e como vamos medir.",
  ],
    "Na proposta, mostre o processo completo, o que o cliente ganha e como vocês vão medir o resultado. O preço vem depois que o valor está claro.",
  ),
];

/* ------------------------------------------------------------------ */
/* Textos das telas                                                    */
/* Nos títulos, **palavra** vira negrito com o degradê da UAU.          */
/* ------------------------------------------------------------------ */

export const COPY = {
  intro: {
    badge: "RAIO-X DO SOCIAL MEDIA",
    title: "Seu cliente te vê como **estrategista** ou como quem só posta?",
    subtitle:
      "Responda 12 perguntas rápidas e descubra sua nota, seu principal gargalo e o que fazer primeiro. Leva uns 2 minutos.",
    areasTitle: "O que a gente analisa",
    meta: [
      { value: "12", label: "perguntas" },
      { value: "2 min", label: "pra responder" },
      { value: "6", label: "áreas no raio-x" },
    ],
    cta: "Começar meu raio-x",
    resume: "Continuar de onde parei",
  },
  lead: {
    eyebrow: "Antes de começar",
    title: "Pra quem vai o seu **diagnóstico?** 🔍",
    text: "No final, você recebe um diagnóstico completo, área por área, com base nas suas respostas. A gente também te avisa quando sair um conteúdo especial sobre isso.",
    consent:
      "Aceito receber mensagens da UAU Digital no WhatsApp e no e-mail sobre conteúdos e novidades. Posso cancelar quando quiser.",
    cta: "Começar as perguntas",
  },
  result: {
    /** Quando a resposta foi a de 3 pontos. */
    answerOk: "Aqui você já age como estrategista.",
    teaser: "Vem coisa grande sobre isso no perfil da UAU 👀",
    ctaTitle: "Quer aprender a **virar esse jogo?**",
    ctaText: "Segue a @uaudigital: vem coisa grande sobre planejamento por aí 👀",
    ctaButton: "Seguir a @uaudigital",
    instagramUrl: "https://instagram.com/uaudigital",
    share: "Compartilhar no story",
    restart: "Refazer o raio-x",
    shareFooter: "Fiz meu Raio-X do Social Media · @uaudigital",
  },
} as const;
