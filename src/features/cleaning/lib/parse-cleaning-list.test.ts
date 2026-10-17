import { describe, expect, it } from "vitest";
import { extractTime, parseCleaningList, parseDaySpec, rowIsReady } from "./parse-cleaning-list";

const people = [
  { id: "u-joao", name: "João Guilherme" }, { id: "u-maria", name: "Maria Souza" }, { id: "u-ana", name: "Ana Beatriz" },
  { id: "u-ana2", name: "Ana Clara" }, { id: "u-pedro", name: "Pedro Lima" },
];
const cats = [{ id: "c-pano", name: "Passar pano" }, { id: "c-varrer", name: "Varrer" }];

describe("dias", () => {
  it("reconhece dia, abreviação, lista, intervalo e 'todos os dias'", () => {
    expect(parseDaySpec("Segunda")).toEqual([1]);
    expect(parseDaySpec("terça-feira:")).toEqual([2]);
    expect(parseDaySpec("seg, qua e sex")).toEqual([1, 3, 5]);
    expect(parseDaySpec("segunda a sexta")).toEqual([1, 2, 3, 4, 5]);
    expect(parseDaySpec("Todos os dias")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseDaySpec("João")).toBeNull();
  });
});

describe("horário", () => {
  it("lê 18h, 17:30 e 'até as 17h30'", () => {
    expect(extractTime("Varrer 18h")).toEqual({ text: "Varrer", time: "18:00" });
    expect(extractTime("Varrer até as 17h30").time).toBe("17:30");
    expect(extractTime("Varrer 9:05").time).toBe("09:05");
    expect(extractTime("Varrer").time).toBeNull();
  });
});

describe("lista em texto", () => {
  it("dia com várias linhas de 'pessoa - tarefa' e categorias que já existem", () => {
    const rows = parseCleaningList("Segunda\nJoão - Passar pano\nMaria - varrer 17h", people, cats);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ day: 1, memberId: "u-joao", categoryId: "c-pano", isNewCategory: false, time: "18:00" });
    expect(rows[1]).toMatchObject({ day: 1, memberId: "u-maria", categoryId: "c-varrer", time: "17:00" });
    expect(rows.every(rowIsReady)).toBe(true);
  });
  it("tudo em uma linha, com ';' e dia antes", () => {
    const rows = parseCleaningList("Terça: João - Varrer; Pedro - Passar pano 16h30", people, cats);
    expect(rows.map((r) => [r.day, r.memberId, r.categoryId, r.time])).toEqual([[2, "u-joao", "c-varrer", "18:00"], [2, "u-pedro", "c-pano", "16:30"]]);
  });
  it("vários dias, várias pessoas e várias tarefas", () => {
    const rows = parseCleaningList("Seg e qua - João e Maria - Varrer e Passar pano", people, cats);
    expect(rows).toHaveLength(2 * 2 * 2);
    expect(new Set(rows.map((r) => r.day))).toEqual(new Set([1, 3]));
  });
  it("tarefa antes da pessoa e pessoa sem separador", () => {
    expect(parseCleaningList("Quarta\nVarrer - João", people, cats)[0]).toMatchObject({ memberId: "u-joao", categoryId: "c-varrer" });
    expect(parseCleaningList("Quinta\nPedro lavar banheiro", people, cats)[0]).toMatchObject({ memberId: "u-pedro", categoryName: "Lavar banheiro", isNewCategory: true });
  });
  it("tarefa nova vira categoria nova (com a primeira letra maiúscula)", () => {
    const r = parseCleaningList("Sexta: Ana Beatriz - limpar geladeira", people, cats)[0];
    expect(r).toMatchObject({ memberId: "u-ana", categoryId: null, categoryName: "Limpar geladeira", isNewCategory: true });
  });
  it("avisa: nome repetido, pessoa desconhecida e linha sem dia", () => {
    const ambiguous = parseCleaningList("Sexta: Ana - Varrer", people, cats)[0];
    expect(ambiguous.memberId).toBeNull();
    expect(ambiguous.memberCandidates.sort()).toEqual(["u-ana", "u-ana2"]);
    expect(ambiguous.problems[0]).toMatch(/Mais de uma pessoa/);
    const unknown = parseCleaningList("Sexta: Zé - Varrer", people, cats)[0];
    expect(unknown.problems[0]).toMatch(/não encontrada/);
    const noDay = parseCleaningList("João - Varrer", people, cats)[0];
    expect(noDay.day).toBeNull();
    expect(rowIsReady(noDay)).toBe(false);
  });
  it("ignora marcadores de lista e linhas vazias", () => {
    const rows = parseCleaningList("Segunda\n\n- João - Varrer\n* Maria - Passar pano", people, cats);
    expect(rows.map((r) => r.memberId)).toEqual(["u-joao", "u-maria"]);
  });
});
