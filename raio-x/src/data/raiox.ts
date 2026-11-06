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
  id: number; // 1..24
  area: AreaId;
  text: string;
  options: [Option, Option, Option, Option];
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
  /** Texto do card "Seu principal gargalo". */
  bottleneck: { diagnosis: string; firstStep: string };
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
  },
  {
    id: "valor",
    number: "06",
    name: "Valor e preço",
    doneWord: "concluído",
    shortName: "Valor",
    emoji: "💰",
    doneText: "Última área analisada. Seu raio-x tá quase pronto.",
    bottleneck: {
      diagnosis:
        "Você cobra pela quantidade de posts, não pelo que entrega. Assim, o cliente compara o seu trabalho com o de qualquer pessoa que posta mais barato.",
      firstStep:
        "Liste tudo o que você faz além de criar posts (análise, estratégia, relatório, reunião) e comece a mostrar isso na sua proposta.",
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
/* Banco de perguntas (24)                                             */
/* ------------------------------------------------------------------ */

const q = (
  id: number,
  area: AreaId,
  text: string,
  o: [string, string, string, string],
): Question => ({
  id,
  area,
  text,
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
  ]),
  q(2, "objetivo", "Se eu perguntar agora qual é o objetivo do seu principal cliente no Instagram, você responde…", [
    "\"Crescer e engajar\", acho.",
    "Ter mais seguidores e aparecer mais.",
    "Vender mais / atrair mais clientes.",
    "Uma meta clara, com número e prazo (ex.: 20 agendamentos pelo direct por mês).",
  ]),
  q(3, "objetivo", "Seus clientes têm metas definidas para o trabalho de vocês?", [
    "Não, a gente vai postando e vendo no que dá.",
    "Tem uma ideia geral, mas nada escrito.",
    "Tem metas, mas sem número ou sem prazo.",
    "Sim, metas com número, prazo e uma forma de medir.",
  ]),
  q(4, "objetivo", "Quando o cliente pede um post que não tem nada a ver com o objetivo dele, você…", [
    "Faço, cliente é quem manda.",
    "Faço, mas fico incomodado.",
    "Faço e tento sugerir algo melhor da próxima vez.",
    "Explico por que aquilo não ajuda no objetivo e proponho uma alternativa.",
  ]),

  // 02 · Diagnóstico
  q(5, "diagnostico", "Antes de criar o primeiro conteúdo, você analisa como o perfil do cliente está hoje?", [
    "Não, já começo do zero com a minha ideia.",
    "Dou uma olhada rápida no feed.",
    "Olho bio, destaques e feed com mais calma.",
    "Faço uma análise completa e registro o que precisa melhorar.",
  ]),
  q(6, "diagnostico", "Você sabe dizer quem é o público do seu cliente, além de idade e gênero?", [
    "Não muito, é \"todo mundo que pode comprar\".",
    "Sei a faixa de idade e a cidade.",
    "Sei mais ou menos as dores e os desejos dele.",
    "Sei a dor, o desejo, as objeções e o que faz ele decidir comprar.",
  ]),
  q(7, "diagnostico", "Com que frequência você olha os números do perfil do cliente?", [
    "Quase nunca.",
    "Quando o cliente pergunta.",
    "Uma vez por mês, mais por obrigação.",
    "Toda semana ou todo mês, e uso isso pra ajustar o que vou postar.",
  ]),
  q(8, "diagnostico", "Você sabe quais conteúdos funcionam melhor para o seu principal cliente?", [
    "Não faço ideia.",
    "Tenho um palpite.",
    "Sei mais ou menos, pelo que lembro.",
    "Sei, com base nos números, e repito o que dá certo.",
  ]),

  // 03 · Concorrentes
  q(9, "concorrentes", "Você analisa os concorrentes do seu cliente?", [
    "Nunca.",
    "Às vezes dou uma olhada pra me inspirar.",
    "Olho os principais de vez em quando.",
    "Analiso com método e anoto o que eles fazem e o que não fazem.",
  ]),
  q(10, "concorrentes", "Quando você olha um concorrente, o que você procura?", [
    "Ideias pra copiar.",
    "O que está bombando pra fazer igual.",
    "O que eles fazem bem.",
    "O que eles NÃO fazem, pra achar o espaço do meu cliente.",
  ]),
  q(11, "concorrentes", "Você consegue explicar em uma frase o que diferencia o seu cliente dos concorrentes?", [
    "Não.",
    "Mais ou menos: \"ele é melhor/mais caprichado\".",
    "Consigo, mas não uso isso no conteúdo.",
    "Consigo, e isso guia o conteúdo dele.",
  ]),
  q(12, "concorrentes", "O conteúdo do seu cliente é parecido com o dos concorrentes?", [
    "Bem parecido, pra ser sincero.",
    "Parecido, só muda a cor e a logo.",
    "Um pouco diferente em alguns pontos.",
    "Bem diferente: tem identidade e posicionamento próprios.",
  ]),

  // 04 · Conteúdo
  q(13, "conteudo", "Como você decide o que postar no mês?", [
    "Na hora, conforme vou tendo ideia.",
    "Pelas datas comemorativas e trends.",
    "Monto um calendário com temas variados.",
    "A partir do objetivo e do diagnóstico, cada post tem um papel.",
  ]),
  q(14, "conteudo", "Se o cliente perguntar \"por que esse post?\", você responde…", [
    "\"Porque estava em alta.\"",
    "\"Porque fica bonito no feed.\"",
    "\"Porque o público gosta desse tipo de conteúdo.\"",
    "\"Porque ele cumpre essa função no plano do mês\" (ex.: quebrar a objeção de preço).",
  ]),
  q(15, "conteudo", "Seus conteúdos levam o público por um caminho (conhecer, confiar, comprar)?", [
    "Não penso nisso.",
    "Já ouvi falar, mas não aplico.",
    "Aplico às vezes.",
    "Sim, distribuo os posts pensando nessa jornada.",
  ]),
  q(16, "conteudo", "Quanto do conteúdo do mês você consegue planejar com antecedência?", [
    "Quase nada, é tudo de última hora.",
    "Uma semana, no máximo.",
    "Boa parte do mês.",
    "O mês inteiro, com espaço pra ajustes e trends que fazem sentido.",
  ]),

  // 05 · Apresentação
  q(17, "apresentacao", "Como o cliente recebe o seu trabalho todo mês?", [
    "Mando os posts pelo WhatsApp pra aprovar.",
    "Mando o feed montado pra ele ver.",
    "Mando um calendário com as legendas.",
    "Apresento um planejamento, explicando o objetivo e o porquê de cada conteúdo.",
  ]),
  q(18, "apresentacao", "Você faz reunião com o cliente para apresentar o planejamento ou os resultados?", [
    "Nunca.",
    "Só quando dá problema.",
    "De vez em quando.",
    "Sim, com frequência definida (mensal, por exemplo).",
  ]),
  q(19, "apresentacao", "Você entrega algum relatório para o cliente?", [
    "Não.",
    "Mando print dos números quando ele pede.",
    "Mando um relatório com curtidas, alcance e seguidores.",
    "Mando um relatório que mostra o que mudou no negócio e os próximos passos.",
  ]),
  q(20, "apresentacao", "Se o seu cliente fosse explicar para um amigo o que você faz, ele diria…", [
    "\"Ela posta no meu Instagram.\"",
    "\"Ela cuida das minhas redes.\"",
    "\"Ela cria o conteúdo e acompanha os números.\"",
    "\"Ela planeja a estratégia do meu Instagram pra trazer resultado.\"",
  ]),

  // 06 · Valor e preço
  q(21, "valor", "Como você define o preço que cobra do cliente?", [
    "Cobro o que o cliente pode pagar.",
    "Pelo que os outros cobram na minha cidade.",
    "Pela quantidade de posts.",
    "Pelo que entrego (estratégia, análise, conteúdo, relatório) e pelo resultado.",
  ]),
  q(22, "valor", "Com que frequência o cliente pede desconto ou questiona o seu preço?", [
    "Quase sempre.",
    "Com frequência.",
    "Às vezes.",
    "Raramente ou nunca.",
  ]),
  q(23, "valor", "Na sua proposta, o que o cliente enxerga?", [
    "Só o valor e a quantidade de posts.",
    "Os posts e os stories por semana.",
    "Os serviços e o que está incluso.",
    "O processo completo, o que ele ganha com isso e como vamos medir.",
  ]),
  q(24, "valor", "Se um concorrente oferecesse o mesmo número de posts pela metade do preço, seu cliente…", [
    "Provavelmente iria embora.",
    "Ficaria balançado.",
    "Talvez ficasse, pela relação.",
    "Ficaria, porque sabe que o seu trabalho vai muito além dos posts.",
  ]),
];

/* ------------------------------------------------------------------ */
/* Textos das telas                                                    */
/* ------------------------------------------------------------------ */

export const COPY = {
  intro: {
    badge: "RAIO-X DO SOCIAL MEDIA",
    title: "Seu cliente te vê como estrategista ou como quem só posta?",
    subtitle:
      "Responda 24 perguntas rápidas e descubra sua nota, seu principal gargalo e o que fazer primeiro. Leva uns 4 minutos.",
    areasTitle: "O que a gente analisa",
    cta: "Começar meu raio-x",
    resume: "Continuar de onde parei",
  },
  lead: {
    title: "Seu raio-x está pronto. 🔍",
    text: "Pra liberar seu resultado, deixa seu contato. A gente também vai te avisar quando sair um conteúdo especial sobre isso.",
    consent:
      "Aceito receber mensagens da UAU Digital no WhatsApp e no e-mail sobre conteúdos e novidades. Posso cancelar quando quiser.",
    cta: "Ver meu resultado",
  },
  result: {
    teaser: "Vem coisa grande sobre isso no perfil da UAU 👀",
    ctaTitle: "Quer aprender a virar esse jogo?",
    ctaText: "Segue a @uaudigital: vem coisa grande sobre planejamento por aí 👀",
    ctaButton: "Seguir a @uaudigital",
    instagramUrl: "https://instagram.com/uaudigital",
    share: "Compartilhar no story",
    restart: "Refazer o raio-x",
    shareFooter: "Fiz meu Raio-X do Social Media · @uaudigital",
  },
} as const;
