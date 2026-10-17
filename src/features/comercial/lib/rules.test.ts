import { describe, expect, it } from "vitest";
import {
  addDays, agoPt, attentionCount, attentionGroups, brl, computeOverview, diffDays, isStale, leadStatus, noFirstContact, nextActivity, shortDate, todayBR, waLink,
  type Activity, type ComercialClient, type Lead, type Stage,
} from "./rules";

const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T15:00:00Z");

const stages: Stage[] = [
  { id: "s0", name: "Entrar em contato", type: "open", probability: 5, position: 0 },
  { id: "s1", name: "Novo contato", type: "open", probability: 10, position: 1 },
  { id: "s2", name: "Em conversa", type: "open", probability: 20, position: 2 },
  { id: "won", name: "Fechado", type: "won", probability: 100, position: 3 },
  { id: "lost", name: "Perdido", type: "lost", probability: 0, position: 4 },
];

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: "l1", name: "Ana", role: null, company: "Empresa", segment: null, city: null, size: null, site: null, phone: "(99) 98812-4410", phone_key: null,
  email: null, instagram: null, source: "WhatsApp", services: [], tags: [], owner_id: "u1", value: 1000, setup: 0, close_by: null, stage_id: "s2",
  stage_changed_at: "2026-10-13T12:00:00Z", closed_at: null, loss_reason: null, whatsapp_contact_id: null, last_message_at: null, created_at: "2026-10-10T12:00:00Z", ...over,
});
const act = (over: Partial<Activity> = {}): Activity => ({ id: "a1", lead_id: "l1", owner_id: "u1", type: "Follow-up", title: "x", due_date: TODAY, done: false, done_at: null, ...over });

describe("datas", () => {
  it("hoje usa o horário de Brasília (21h30 em Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC)", () => {
    expect(todayBR(new Date("2026-10-15T00:30:00Z"))).toBe("2026-10-14");
    expect(todayBR(new Date("2026-10-15T03:30:00Z"))).toBe("2026-10-15");
  });
  it("diffDays e addDays", () => {
    expect(diffDays("2026-10-12", TODAY)).toBe(-2);
    expect(diffDays("2026-10-14", TODAY)).toBe(0);
    expect(addDays(3, TODAY)).toBe("2026-10-17");
    expect(addDays(-14, TODAY)).toBe("2026-09-30");
  });
  it("formata data curta e moeda", () => {
    expect(shortDate("2026-10-14")).toBe("14/10");
    expect(brl(2500)).toBe("R$ 2.500");
    expect(brl(null)).toBe("R$ 0");
  });
});

describe("link do WhatsApp", () => {
  it("só dígitos e prefixo 55", () => {
    expect(waLink("(99) 98812-4410")).toBe("https://wa.me/5599988124410");
    expect(waLink("+55 99 98812-4410")).toBe("https://wa.me/5599988124410");
    expect(waLink("")).toBe("");
  });
});

describe("status do lead", () => {
  it("atrasado, hoje, futuro e sem próxima ação", () => {
    const s = stages[2];
    expect(leadStatus(s, "l1", [act({ due_date: "2026-10-12" })], TODAY)).toBe("late");
    expect(leadStatus(s, "l1", [act({ due_date: TODAY })], TODAY)).toBe("today");
    expect(leadStatus(s, "l1", [act({ due_date: "2026-10-20" })], TODAY)).toBe("future");
    expect(leadStatus(s, "l1", [], TODAY)).toBe("none");
  });
  it("usa a atividade pendente mais próxima e ignora as concluídas", () => {
    const acts = [act({ id: "a2", due_date: "2026-10-20" }), act({ id: "a1", due_date: "2026-10-12", done: true }), act({ id: "a3", due_date: "2026-10-15" })];
    expect(nextActivity("l1", acts)?.id).toBe("a3");
  });
  it("lead fechado não tem status", () => {
    expect(leadStatus(stages[3], "l1", [], TODAY)).toBeNull();
  });
});

describe("parado e sem primeiro contato", () => {
  it("parado a partir de 7 dias na mesma etapa", () => {
    expect(isStale(lead({ stage_changed_at: "2026-10-07T12:00:00Z" }), stages[2], NOW)).toBe(true);
    expect(isStale(lead({ stage_changed_at: "2026-10-09T12:00:00Z" }), stages[2], NOW)).toBe(false);
    expect(isStale(lead({ stage_changed_at: "2026-09-01T12:00:00Z" }), stages[3], NOW)).toBe(false);
  });
  it("sem primeiro contato só nas duas primeiras etapas abertas", () => {
    expect(noFirstContact(lead({ stage_id: "s1" }), stages, [], new Set())).toBe(true);
    expect(noFirstContact(lead({ stage_id: "s2" }), stages, [], new Set())).toBe(false);
    expect(noFirstContact(lead({ stage_id: "s1" }), stages, [], new Set(["l1"]))).toBe(false);
    expect(noFirstContact(lead({ stage_id: "s1" }), stages, [act({ done: true })], new Set())).toBe(false);
  });
});

describe("visão geral", () => {
  const leads = [
    lead({ id: "a", stage_id: "s2", value: 1000 }),
    lead({ id: "b", stage_id: "s1", value: 2000 }),
    lead({ id: "w", stage_id: "won", value: 3000, created_at: "2026-10-01T12:00:00Z", closed_at: "2026-10-11T12:00:00Z" }),
    lead({ id: "x", stage_id: "lost", value: 500, closed_at: "2026-10-12T12:00:00Z" }),
  ];
  it("pipeline é a soma dos abertos e a previsão pondera pela etapa", () => {
    const o = computeOverview(leads, stages, [], [], 30, TODAY);
    expect(o.pipeline).toBe(3000);
    expect(o.forecast).toBe(1000 * 0.2 + 2000 * 0.1);
  });
  it("conversão = ganhos ÷ (ganhos + perdidos) e ciclo médio em dias", () => {
    const o = computeOverview(leads, stages, [], [], 30, TODAY);
    expect(o.conversion).toBe(50);
    expect(o.cycleDays).toBe(10);
    expect(o.ticket).toBe(3000);
  });
  it("sem fechamentos não inventa conversão", () => {
    const o = computeOverview([leads[0]], stages, [], [], 30, TODAY);
    expect(o.conversion).toBeNull();
    expect(o.cycleDays).toBeNull();
  });
  it("MRR soma o valor dos clientes", () => {
    const clients = [{ value: 2800 }, { value: 4800 }] as ComercialClient[];
    expect(computeOverview(leads, stages, [], clients, 30, TODAY).mrr).toBe(7600);
  });
  it("período filtra por data; 0 é o período todo", () => {
    const old = lead({ id: "o", stage_id: "won", closed_at: "2026-05-01T12:00:00Z", created_at: "2026-04-01T12:00:00Z" });
    expect(computeOverview([old], stages, [], [], 30, TODAY).won).toHaveLength(0);
    expect(computeOverview([old], stages, [], [], 0, TODAY).won).toHaveLength(1);
  });
});

describe("o que fazer agora", () => {
  it("agrupa atrasados, reuniões de hoje, sem próxima ação e parados", () => {
    const leads = [lead({ id: "a" }), lead({ id: "b", stage_id: "s1" }), lead({ id: "c", stage_changed_at: "2026-10-01T12:00:00Z" })];
    const acts = [
      act({ id: "1", lead_id: "a", due_date: "2026-10-12" }),
      act({ id: "2", lead_id: "a", type: "Reunião", due_date: TODAY }),
      act({ id: "3", lead_id: "c", due_date: "2026-10-20" }),
    ];
    const groups = attentionGroups(leads, stages, acts, [], [], new Set(), TODAY, NOW);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.length]));
    expect(byKey.late).toBe(1);
    expect(byKey.meet).toBe(1);
    expect(byKey.none).toBe(1); // o "b"
    expect(byKey.first).toBe(1); // o "b" está numa das duas primeiras etapas e nunca foi contatado
    expect(byKey.stale).toBe(1); // o "c"
    expect(attentionCount(groups)).toBe(1 + 1 + 1 + 1 + 0);
  });
  it("não lista grupo vazio", () => {
    expect(attentionGroups([], stages, [], [], [], new Set(), TODAY, NOW)).toEqual([]);
  });
});

describe("agoPt", () => {
  const now = new Date("2026-10-17T15:00:00Z");
  it("diz há quanto tempo foi, em português", () => {
    expect(agoPt("2026-10-17T14:59:40Z", now)).toBe("agora");
    expect(agoPt("2026-10-17T14:20:00Z", now)).toBe("há 40 min");
    expect(agoPt("2026-10-17T12:00:00Z", now)).toBe("há 3 h");
    expect(agoPt("2026-10-16T12:00:00Z", now)).toBe("ontem");
    expect(agoPt("2026-10-12T15:00:00Z", now)).toBe("há 5 dias");
    expect(agoPt(null, now)).toBeUndefined();
  });
});
