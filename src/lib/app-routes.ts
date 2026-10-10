import type { MainTab } from "@/components/layout/UauSidebarShell";

// Slug usado na URL para cada MainTab. Fica num único lugar pra não deixar o
// vocabulário de URL divergir das chaves internas usadas em Index.tsx/UauSidebarShell.tsx.
// "tarefas" (o valor literal do MainTab, só existe como alias de destaque no
// menu mobile — nunca é de fato atribuído como aba ativa) fica de fora de propósito.
const SIMPLE_TAB_SLUGS: Partial<Record<MainTab, string>> = {
  meu_painel: "meu-painel",
  visao_geral_projetos: "painel-de-squads",
  fluxos: "fluxos",
  visao_do_dia: "visao-do-dia",
  magic2: "magic-number",
  desempenho: "the-best",
  recompensas: "uau-xp",
  comercial: "comercial",
  resultados: "resultados",
  clientes: "clientes",
  conversas: "conversas",
  ajuda: "ajuda",
  financeiro: "financeiro",
  metas: "financeiro/metas",
  fin_receitas_despesas: "financeiro/receitas-despesas",
  fin_despesas_detalhadas: "financeiro/despesas-detalhadas",
  fin_lancamentos: "financeiro/lancamentos",
};

// Abas do GestaoPanel que abrem o diálogo de tarefa por cima da lista — cada uma
// tem uma rota base (ex.: /agenda) e aceita um segmento opcional /:taskId.
// calendario_publicacao e cronograma são as duas exceções que NÃO usam o nome
// exato da aba ("Cronograma" pras duas): colidiriam entre si e com a rota
// pública /cronograma/:taskId — decisão consciente, não descuido.
const GESTAO_TAB_SLUGS: Partial<Record<MainTab, string>> = {
  agenda_gestao: "agenda",
  pauta_pessoas: "pauta",
  calendario_publicacao: "calendario-editorial",
  cronograma: "cronograma-global",
  gestao_por_cliente: "tarefas-por-cliente",
  gestao_montagem_pauta: "montagem-pauta",
};

const GESTAO_SLUG_TO_TAB: Record<string, MainTab> = Object.fromEntries(
  Object.entries(GESTAO_TAB_SLUGS).map(([tab, slug]) => [slug as string, tab as MainTab])
);

// Só o "datas" (título real: "Datas internas") diverge do nome da subaba usado
// internamente pelo AdminContainer — o resto do AdminSubTab já é 1:1 com a URL.
const ADMIN_SUBTAB_SLUGS: Record<string, string> = { datas: "datas-internas" };
const ADMIN_SLUG_TO_SUBTAB: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_SUBTAB_SLUGS).map(([subTab, slug]) => [slug, subTab])
);

const SIMPLE_SLUG_TO_TAB: Record<string, MainTab> = Object.fromEntries(
  Object.entries(SIMPLE_TAB_SLUGS)
    .filter(([, slug]) => !(slug as string).includes("/"))
    .map(([tab, slug]) => [slug as string, tab as MainTab])
);

type ParsedAppPath = {
  tab: MainTab;
  adminSubTab?: string;
  taskId?: string;
  clienteId?: string;
};

// Toda rota autenticada do app (declaradas de forma explícita em App.tsx, sem
// coringa) resolve pra cá. Espelha exatamente o que tabPath() abaixo gera.
export function parseAppPath(pathname: string): ParsedAppPath {
  const segs = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const [first, second, third] = segs;

  if (first === "financeiro") {
    if (second === "metas") return { tab: "metas" };
    if (second === "clientes") return { tab: "fin_clientes" };
    if (second === "receitas-despesas") return { tab: "fin_receitas_despesas" };
    if (second === "despesas-detalhadas") return { tab: "fin_despesas_detalhadas" };
    if (second === "lancamentos") return { tab: "fin_lancamentos" };
    return { tab: "financeiro" };
  }

  if (first === "configuracoes") {
    if (second === "clientes") return { tab: "configuracoes", adminSubTab: "clientes", clienteId: third };
    if (second) return { tab: "configuracoes", adminSubTab: ADMIN_SLUG_TO_SUBTAB[second] ?? second };
    return { tab: "configuracoes" };
  }

  if (first === "clientes") return { tab: "clientes", clienteId: second };

  if (first && first in GESTAO_SLUG_TO_TAB) {
    return { tab: GESTAO_SLUG_TO_TAB[first], taskId: second };
  }

  if (first && first in SIMPLE_SLUG_TO_TAB) {
    return { tab: SIMPLE_SLUG_TO_TAB[first] };
  }

  return { tab: "meu_painel" };
}

// Inverso de parseAppPath — monta a URL a partir da aba (+ opcionalmente subaba
// do Admin, id de tarefa ou id de cliente).
export function tabPath(
  tab: MainTab,
  opts?: { adminSubTab?: string | null; taskId?: string | null; clienteId?: string | null }
): string {
  if (tab === "configuracoes") {
    if (opts?.adminSubTab === "clientes" && opts?.clienteId) return `/configuracoes/clientes/${opts.clienteId}`;
    if (opts?.adminSubTab) return `/configuracoes/${ADMIN_SUBTAB_SLUGS[opts.adminSubTab] ?? opts.adminSubTab}`;
    return "/configuracoes";
  }
  if (tab === "fin_clientes") return "/financeiro/clientes";
  if (tab === "clientes") return opts?.clienteId ? `/clientes/${opts.clienteId}` : "/clientes";

  const gestaoSlug = GESTAO_TAB_SLUGS[tab];
  if (gestaoSlug) return opts?.taskId ? `/${gestaoSlug}/${opts.taskId}` : `/${gestaoSlug}`;

  const simpleSlug = SIMPLE_TAB_SLUGS[tab];
  if (simpleSlug) return `/${simpleSlug}`;

  return "/meu-painel";
}

// Lista explícita (sem coringa) de todo caminho que o app autenticado responde —
// registrada literalmente em App.tsx pra nunca disputar rota com /auth, /pending,
// /cronograma/:taskId (pública) etc. por ranking do react-router.
export const APP_TAB_ROUTES: string[] = [
  "meu-painel",
  "painel-de-squads",
  "fluxos",
  "visao-do-dia",
  "magic-number",
  "the-best",
  "uau-xp",
  "comercial",
  "resultados",
  "clientes",
  "clientes/:clienteId",
  "conversas",
  "ajuda",
  "financeiro",
  "financeiro/metas",
  "financeiro/clientes",
  "financeiro/receitas-despesas",
  "financeiro/despesas-detalhadas",
  "financeiro/lancamentos",
  "configuracoes",
  "configuracoes/usuarios",
  "configuracoes/cargos",
  "configuracoes/clientes",
  "configuracoes/clientes/:clienteId",
  "configuracoes/notificacoes",
  "configuracoes/datas-internas",
  "configuracoes/limpeza",
  "configuracoes/pontuacao",
  "configuracoes/aparencia",
  "configuracoes/whatsapp",
  ...Object.values(GESTAO_TAB_SLUGS).flatMap((slug) => [slug, `${slug}/:taskId`]),
];
