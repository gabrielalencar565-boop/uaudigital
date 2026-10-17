// Formulários e automações do CRM: tipos, blocos, gatilhos, modelos prontos (CRM-HANDOFF) e funções puras do editor.

import { SERVICES } from "./rules";

// ───────────── tipos ─────────────

export type StepType = "msg" | "ask" | "cond" | "wait" | "tag" | "deal" | "task" | "meet" | "form" | "human";
export type TriggerType = "new" | "msg_in" | "msg_back" | "form" | "stage" | "won" | "idle" | "schedule";

export interface Step {
  id: string;
  type: StepType;
  text?: string;
  options?: string[];
  saveTo?: string;
  field?: string;
  value?: string;
  yes?: Step[];
  no?: Step[];
  amount?: number;
  unit?: "horas" | "dias";
  until?: "resposta" | "tempo";
  tag?: string;
  stage?: string;
  owner?: string;
  ttype?: string;
  title?: string;
  days?: number;
  formId?: string;
  formKey?: string;
}

export interface Trigger {
  type: TriggerType;
  formId?: string;
  stage?: string;
  days?: number;
  every?: string;
  hours?: number;
}

export type FieldType = "text" | "long" | "phone" | "email" | "number" | "choice" | "multi" | "date" | "scale" | "file" | "consent";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options: string[];
  map: string;
}

export interface FormDest {
  create: boolean;
  stage_id: string | null;
  owner_id: string | null;
  tag: string;
}

export interface ComercialForm {
  id: string;
  key: string;
  name: string;
  description: string;
  fields: FormField[];
  active: boolean;
  dest: FormDest;
  thanks: string;
  slug: string;
  created_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  lead_id: string | null;
  answers: Record<string, string>;
  submitted_at: string;
}

export interface ComercialAutomation {
  id: string;
  name: string;
  active: boolean;
  trigger: Trigger;
  steps: Step[];
  runs: number;
  last_run_at: string | null;
  created_at: string;
}

export interface SavedTemplate {
  id: string;
  kind: "auto" | "form";
  name: string;
  description: string;
  payload: Record<string, unknown>;
}

// ───────────── textos ─────────────

export const BLOCKS: Record<StepType, { name: string; group: "msg" | "logic" | "act"; desc: string }> = {
  msg: { name: "Enviar mensagem", group: "msg", desc: "Boas-vindas, pedir informação ou mandar um link" },
  ask: { name: "Pergunta", group: "msg", desc: "Pergunta com opções e salva a resposta" },
  cond: { name: "Condição", group: "logic", desc: "Segue caminhos diferentes conforme a resposta ou o CRM" },
  wait: { name: "Aguardar", group: "logic", desc: "Espera uma resposta ou um tempo" },
  tag: { name: "Aplicar etiqueta", group: "act", desc: "Marca o lead (ex.: Prioritário)" },
  deal: { name: "Atualizar oportunidade", group: "act", desc: "Move de etapa ou troca o responsável" },
  task: { name: "Criar tarefa", group: "act", desc: "Lembra alguém da equipe de agir" },
  meet: { name: "Agendar reunião", group: "msg", desc: "Oferece horários e registra a reunião" },
  form: { name: "Enviar formulário", group: "msg", desc: "Manda o link de um formulário" },
  human: { name: "Transferir para humano", group: "act", desc: "Pausa a automação e passa pra uma pessoa" },
};

export const TRIGGERS: Record<TriggerType, string> = {
  new: "Novo lead cadastrado",
  msg_in: "Mensagem de contato novo no WhatsApp",
  msg_back: "Lead que já existe manda nova mensagem",
  form: "Formulário enviado",
  stage: "Negócio entra na etapa",
  won: "Negócio ganho",
  idle: "Negócio parado há alguns dias",
  schedule: "Data programada",
};

export const COND_FIELDS: Record<string, string> = {
  answer: "Última resposta", services: "Serviço de interesse", segment: "Segmento", source: "Origem", tags: "Etiquetas", replied: "Lead respondeu",
};
export const SAVE_TO: Record<string, string> = { "": "Só guardar a resposta", services: "Serviço de interesse", segment: "Segmento", budget: "Orçamento" };

export const FIELD_TYPES: Record<FieldType, string> = {
  text: "Texto curto", long: "Texto longo", phone: "WhatsApp / telefone", email: "E-mail", number: "Número", choice: "Múltipla escolha (uma)",
  multi: "Caixas de seleção (várias)", date: "Data", scale: "Escala de 0 a 10", file: "Arquivo", consent: "Consentimento (LGPD)",
};
export const FIELD_MAPS: Record<string, string> = {
  "": "Não salvar no lead", name: "Nome", company: "Empresa", phone: "WhatsApp", email: "E-mail", ig: "Instagram", segment: "Segmento", city: "Cidade", services: "Serviços de interesse",
};
export const CONSENT_TEXT = "Aceito receber contato da UAU Digital por WhatsApp e e-mail sobre este pedido.";

export const PUBLIC_FORM_URL = "https://appfluxo.app.br/f/";

// ───────────── ids, texto e árvore ─────────────

let counter = 0;
export const newId = (): string => `b${Date.now().toString(36)}${(++counter).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const slugify = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "formulario";

/** Link do formulário: nome + um trecho aleatório (não dá para adivinhar o link de outro formulário). */
export const makeSlug = (name: string): string => `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

const firstName = (name: string) => name.replace(/^(dra?\.?)\s+/i, "").trim().split(/\s+/)[0] ?? "";

/** {nome} e {empresa}, como o motor do banco troca na hora de enviar. */
export function fillText(t: string | undefined, lead?: { name?: string; company?: string | null }): string {
  const nome = lead?.name ? firstName(lead.name) : "Fulano";
  return String(t ?? "").replace(/\{nome\}/g, nome).replace(/\{empresa\}/g, lead?.company || "Empresa");
}

export const countSteps = (list: Step[] = []): number => list.reduce((a, s) => a + 1 + (s.type === "cond" ? countSteps(s.yes) + countSteps(s.no) : 0), 0);

export function findStep(id: string, list: Step[]): { step: Step; list: Step[]; index: number } | null {
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.id === id) return { step: s, list, index: i };
    if (s.type === "cond") {
      const r = findStep(id, s.yes ?? []) ?? findStep(id, s.no ?? []);
      if (r) return r;
    }
  }
  return null;
}

/** "root" ou "<idDaCondição>:yes|no" */
export function findList(key: string, steps: Step[]): Step[] | null {
  if (key === "root") return steps;
  const [id, branch] = key.split(":");
  const c = findStep(id, steps);
  if (!c || c.step.type !== "cond") return null;
  return (branch === "yes" ? c.step.yes : c.step.no) ?? null;
}

export function reid(list: Step[]): Step[] {
  return list.map((s) => ({ ...s, id: newId(), ...(s.type === "cond" ? { yes: reid(s.yes ?? []), no: reid(s.no ?? []) } : {}) }));
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function makeStep(type: StepType, firstFormId?: string): Step {
  const base = { id: newId(), type };
  switch (type) {
    case "msg": return { ...base, text: "Oi, {nome}! " };
    case "ask": return { ...base, text: "", options: ["Sim", "Não"], saveTo: "" };
    case "cond": return { ...base, field: "answer", value: "", yes: [], no: [] };
    case "wait": return { ...base, amount: 1, unit: "dias", until: "resposta" };
    case "tag": return { ...base, tag: "Prioritário" };
    case "deal": return { ...base, stage: "", owner: "" };
    case "task": return { ...base, ttype: "Follow-up", title: "Chamar o lead", days: 0, owner: "lead" };
    case "meet": return { ...base, text: "Escolha o melhor horário pra nossa conversa:", options: ["Amanhã 10h", "Amanhã 15h"] };
    case "form": return { ...base, formId: firstFormId };
    case "human": return { ...base, owner: "lead" };
  }
}

/** Condição do fluxo, igual à do motor do banco (para o botão "Testar"). */
export function condTrue(s: Step, lead: { services: string[]; tags: string[]; segment?: string | null; source?: string }, vars: { answer?: string; replied?: boolean }): boolean {
  if (s.field === "replied") return !!vars.replied;
  const v = s.field === "answer" ? vars.answer ?? ""
    : s.field === "services" ? lead.services.join(", ")
    : s.field === "tags" ? lead.tags.join(", ")
    : s.field === "segment" ? lead.segment ?? ""
    : s.field === "source" ? lead.source ?? "" : "";
  return v.toLowerCase().includes((s.value ?? "").toLowerCase());
}

// ───────────── modelos prontos ─────────────

export interface TemplateCtx {
  /** id da etapa pelo nome ("Em conversa"); "" se a agência não tem essa etapa */
  stageByName: (name: string) => string;
}

const STAGE_KEY_NAMES: Record<string, string> = { novo: "Novo contato", conversa: "Em conversa", agendada: "Reunião agendada", feita: "Reunião feita" };

const fld = (type: FieldType, label: string, o: { req?: boolean; opt?: string[]; map?: string } = {}): FormField => ({
  id: newId(), type, label, required: !!o.req, options: o.opt ?? [], map: o.map ?? "",
});

export interface FormTemplate { name: string; desc: string; fields: () => FormField[] }

export const FORM_TPL: Record<string, FormTemplate> = {
  capt: { name: "Captação de leads", desc: "Formulário curto pra site, bio e campanhas.", fields: () => [
    fld("text", "Seu nome", { req: true, map: "name" }), fld("text", "Nome da empresa", { map: "company" }), fld("phone", "WhatsApp", { req: true, map: "phone" }),
    fld("multi", "O que você procura?", { opt: [...SERVICES], map: "services" }), fld("consent", CONSENT_TEXT, { req: true })] },
  diag: { name: "Diagnóstico comercial", desc: "Segmento, desafios, objetivos, orçamento e prazo.", fields: () => [
    fld("text", "Seu nome", { req: true, map: "name" }), fld("text", "Nome da empresa", { req: true, map: "company" }), fld("phone", "WhatsApp", { req: true, map: "phone" }),
    fld("email", "E-mail", { map: "email" }), fld("text", "Segmento do negócio", { map: "segment" }), fld("long", "Qual o maior desafio do seu marketing hoje?"),
    fld("multi", "Quais são seus objetivos?", { opt: ["Vender mais", "Ser mais conhecido", "Organizar as redes sociais", "Gerar contatos"] }),
    fld("choice", "Quanto pretende investir por mês?", { req: true, opt: ["Até R$ 1.500", "De R$ 1.500 a R$ 3.000", "Acima de R$ 3.000"] }),
    fld("choice", "Quando quer começar?", { opt: ["Imediatamente", "Em até 30 dias", "Em 2 a 3 meses"] }), fld("consent", CONSENT_TEXT, { req: true })] },
  bsoc: { name: "Briefing de redes sociais", desc: "Público, identidade, posicionamento, concorrentes e referências.", fields: () => [
    fld("text", "Nome da empresa", { req: true, map: "company" }), fld("long", "Quem é o seu público?", { req: true }), fld("long", "Como você descreve a identidade da marca?"),
    fld("long", "Como quer ser percebido?"), fld("long", "Quem são seus concorrentes?"), fld("long", "Perfis que você admira (referências)"), fld("file", "Logo e materiais da marca")] },
  baud: { name: "Briefing audiovisual", desc: "Objetivo, tema, local, participantes e referências.", fields: () => [
    fld("text", "Objetivo do vídeo", { req: true }), fld("text", "Tema"), fld("text", "Local da gravação"), fld("text", "Quem vai aparecer?"), fld("date", "Data desejada"), fld("long", "Referências")] },
  onb: { name: "Onboarding de novos clientes", desc: "Contatos, acessos, arquivos, aprovação e escopo.", fields: () => [
    fld("text", "Responsável pelas aprovações", { req: true }), fld("phone", "WhatsApp de quem aprova", { req: true }),
    fld("choice", "Como vamos receber os acessos às contas?", { req: true, opt: ["Convite de parceiro no Meta Business", "Reunião rápida pra configurar juntos"] }),
    fld("file", "Logo, fotos e materiais"), fld("consent", "Confirmo o escopo contratado e o fluxo de aprovação.", { req: true })] },
  dem: { name: "Solicitação de demandas", desc: "Peça, descrição, arquivos, prioridade e data.", fields: () => [
    fld("choice", "O que você precisa?", { req: true, opt: ["Post", "Story", "Vídeo", "Campanha", "Outro"] }), fld("long", "Descreva o pedido", { req: true }),
    fld("file", "Arquivos de apoio"), fld("choice", "Prioridade", { opt: ["Normal", "Urgente"] }), fld("date", "Pra quando?")] },
  sat: { name: "Pesquisa de satisfação", desc: "Nota, experiência, pontos positivos e melhorias.", fields: () => [
    fld("scale", "De 0 a 10, quanto você recomendaria a UAU Digital?", { req: true }), fld("long", "Como está sendo a experiência?"),
    fld("long", "O que estamos fazendo bem?"), fld("long", "O que podemos melhorar?")] },
  rel: { name: "Avaliação de relacionamento", desc: "Sinais de risco, dificuldades e sugestões.", fields: () => [
    fld("choice", "Como está a comunicação com a equipe?", { opt: ["Ótima", "Boa", "Precisa melhorar"] }), fld("long", "Alguma dificuldade nas últimas semanas?"), fld("long", "Sugestões pro atendimento")] },
};

export interface AutoTemplate { name: string; desc: string; trigger: (c: TemplateCtx) => Trigger; steps: (c: TemplateCtx) => Step[] }

const S = (type: StepType, cfg: Partial<Step> = {}): Step => ({ id: newId(), type, ...cfg });

export const AUTO_TPL: Record<string, AutoTemplate> = {
  welcome: { name: "Boas-vindas ao lead", desc: "Novo contato → saudação → pergunta → etiqueta → vendedor.", trigger: () => ({ type: "msg_in" }), steps: () => [
    S("msg", { text: "Oi! Aqui é da UAU Digital. Que bom ter você por aqui 😊" }),
    S("ask", { text: "Qual serviço você procura?", options: ["Redes sociais", "Tráfego pago", "Posicionamento de marca"], saveTo: "services" }),
    S("tag", { tag: "Novo contato WhatsApp" }), S("human", { owner: "lead" })] },
  retorno: { name: "Retorno de lead", desc: "Quem já tinha falado escreve de novo → recebe uma resposta → alerta a equipe.", trigger: () => ({ type: "msg_back", hours: 24 }), steps: () => [
    S("msg", { text: "Oi, {nome}! Que bom te ver de novo por aqui 😊 Em que posso te ajudar hoje?" }),
    S("task", { ttype: "Follow-up", title: "Responder lead que voltou a falar", days: 0, owner: "lead" }), S("human", { owner: "lead" })] },
  qualif: { name: "Qualificação comercial", desc: "Pergunta o interesse, segue o caminho certo e atualiza o CRM.", trigger: () => ({ type: "msg_in" }), steps: (c) => [
    S("msg", { text: "Oi, {nome}! Aqui é da UAU Digital. Vou te fazer duas perguntas rápidas pra entender o que você precisa." }),
    S("ask", { text: "Qual serviço você procura?", options: ["Redes sociais", "Tráfego pago"], saveTo: "services" }),
    S("cond", { field: "answer", value: "Redes sociais",
      yes: [S("ask", { text: "Me conta: o que sua empresa vende e pra quem?", options: [] }), S("ask", { text: "Hoje vocês postam com frequência?", options: ["Sim", "Às vezes", "Não"] }), S("tag", { tag: "Conteúdo" })],
      no: [S("ask", { text: "Quanto pretende investir por mês em anúncios?", options: ["Até R$ 1.000", "R$ 1.000 a R$ 3.000", "Acima de R$ 3.000"], saveTo: "budget" }),
           S("ask", { text: "Qual o principal objetivo da campanha?", options: ["Vender mais", "Gerar contatos", "Divulgar a marca"] }), S("tag", { tag: "Tráfego pago" })] }),
    S("deal", { stage: c.stageByName(STAGE_KEY_NAMES.conversa), owner: "" }),
    S("task", { ttype: "Follow-up", title: "Chamar no WhatsApp e marcar reunião", days: 0, owner: "lead" }), S("human", { owner: "lead" })] },
  follow: { name: "Follow-up de proposta", desc: "Proposta apresentada → espera → verifica resposta → age.", trigger: (c) => ({ type: "stage", stage: c.stageByName(STAGE_KEY_NAMES.feita) }), steps: () => [
    S("wait", { amount: 2, unit: "dias", until: "resposta" }),
    S("cond", { field: "replied", value: "sim", yes: [S("human", { owner: "lead" })],
      no: [S("msg", { text: "Oi, {nome}! Conseguiu ver a proposta que apresentamos? Fico à disposição pra tirar qualquer dúvida." }), S("task", { ttype: "Ligação", title: "Ligar pra saber da proposta", days: 1, owner: "lead" })] })] },
  meet: { name: "Agendamento de reunião", desc: "Lead qualificado → oferece horários → confirma → registra.", trigger: (c) => ({ type: "stage", stage: c.stageByName(STAGE_KEY_NAMES.conversa) }), steps: (c) => [
    S("meet", { text: "Que tal uma conversa de 30 minutos pra eu te mostrar como podemos ajudar? Escolha um horário:", options: ["Amanhã 10h", "Amanhã 15h", "Sexta 9h"] }),
    S("deal", { stage: c.stageByName(STAGE_KEY_NAMES.agendada), owner: "" }),
    S("task", { ttype: "Reunião", title: "Reunião de apresentação", days: 1, owner: "lead" }), S("msg", { text: "Reunião confirmada! Te mando o lembrete no dia." })] },
  onboard: { name: "Onboarding de cliente", desc: "Negócio ganho → boas-vindas → formulário → tarefas.", trigger: () => ({ type: "won" }), steps: () => [
    S("msg", { text: "Seja bem-vindo(a) à UAU Digital, {nome}! Vamos começar pelo briefing." }), S("form", { formKey: "onb" }),
    S("task", { ttype: "Tarefa", title: "Agendar reunião de briefing online", days: 1, owner: "lead" })] },
  sat: { name: "Pesquisa de satisfação", desc: "Data programada → formulário → espera → alerta ao gestor.", trigger: () => ({ type: "schedule", every: "Todo dia 1º, para clientes ativos" }), steps: () => [
    S("form", { formKey: "sat" }), S("wait", { amount: 3, unit: "dias", until: "tempo" }),
    S("task", { ttype: "Tarefa", title: "Ver resultado da pesquisa de satisfação", days: 0, owner: "lead" })] },
};

export const emptyDest = (): FormDest => ({ create: true, stage_id: null, owner_id: null, tag: "" });

/** Passos "Enviar formulário" que vieram de um modelo (só têm `formKey`) ligam ao formulário da agência de mesma chave, se já existir. */
export function linkFormSteps(steps: Step[], forms: Array<{ id: string; key: string }>): Step[] {
  return steps.map((s) => {
    if (s.type === "cond") return { ...s, yes: linkFormSteps(s.yes ?? [], forms), no: linkFormSteps(s.no ?? [], forms) };
    if (s.type === "form" && !s.formId && s.formKey) return { ...s, formId: forms.find((f) => f.key === s.formKey)?.id };
    return s;
  });
}

/** O motor envia mensagem no WhatsApp de verdade: o aviso de ativação só aparece quando o fluxo tem algum passo que fala com o lead. */
export function sendsMessages(steps: Step[]): boolean {
  return steps.some((s) => ["msg", "ask", "meet", "form"].includes(s.type) || (s.type === "cond" && (sendsMessages(s.yes ?? []) || sendsMessages(s.no ?? []))));
}
