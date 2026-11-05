import { describe, expect, it } from "vitest";
import { anchorForDate, cycleEnd, cycleMonthYear, cycleStart, makeDiaDFor, resolveDiaD } from "./dia-d";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// novembro fecha dia 25, dezembro dia 18; o resto usa o 27
const dayFor = makeDiaDFor(27, [
  { year: 2026, month: 11, day: 25, reason: null },
  { year: 2026, month: 12, day: 18, reason: "Festas de fim de ano" },
]);

describe("makeDiaDFor", () => {
  it("usa a exceção do mês e o padrão nos demais", () => {
    expect(dayFor(2026, 10)).toBe(27);
    expect(dayFor(2026, 11)).toBe(25);
    expect(dayFor(2026, 12)).toBe(18);
    expect(dayFor(2027, 1)).toBe(27);
    expect(dayFor(2027, 12)).toBe(27); // exceção é de um ano só
  });
  it("normaliza o mês fora de 1-12", () => {
    expect(dayFor(2027, 0)).toBe(18); // dezembro de 2026
    expect(dayFor(2026, 13)).toBe(27); // janeiro de 2027
  });
  it("resolveDiaD aceita número ou função", () => {
    expect(resolveDiaD(27, 2026, 12)).toBe(27);
    expect(resolveDiaD(dayFor, 2026, 12)).toBe(18);
  });
});

describe("cycleMonthYear", () => {
  it("até o Dia D é o próprio mês, depois é o seguinte", () => {
    expect(cycleMonthYear(new Date(2026, 10, 25), dayFor)).toEqual({ year: 2026, month: 11 });
    expect(cycleMonthYear(new Date(2026, 10, 26), dayFor)).toEqual({ year: 2026, month: 12 });
    expect(cycleMonthYear(new Date(2026, 11, 18), dayFor)).toEqual({ year: 2026, month: 12 });
    expect(cycleMonthYear(new Date(2026, 11, 19), dayFor)).toEqual({ year: 2027, month: 1 });
  });
  it("com o dia padrão (número) se comporta como antes", () => {
    expect(cycleMonthYear(new Date(2026, 11, 27), 27)).toEqual({ year: 2026, month: 12 });
    expect(cycleMonthYear(new Date(2026, 11, 28), 27)).toEqual({ year: 2027, month: 1 });
  });
});

describe("ciclos encadeados", () => {
  it("novembro 28/10→25/11, dezembro 26/11→18/12, janeiro 19/12→27/01", () => {
    const nov = new Date(2026, 10, 1);
    const dez = new Date(2026, 11, 1);
    const jan = new Date(2027, 0, 1);
    expect([ymd(cycleStart(nov, dayFor)), ymd(cycleEnd(nov, dayFor))]).toEqual(["2026-10-28", "2026-11-25"]);
    expect([ymd(cycleStart(dez, dayFor)), ymd(cycleEnd(dez, dayFor))]).toEqual(["2026-11-26", "2026-12-18"]);
    expect([ymd(cycleStart(jan, dayFor)), ymd(cycleEnd(jan, dayFor))]).toEqual(["2026-12-19", "2027-01-27"]);
  });
  it("sem exceção é o ciclo 28→27 de sempre", () => {
    const out = new Date(2026, 9, 1);
    expect([ymd(cycleStart(out, 27)), ymd(cycleEnd(out, 27))]).toEqual(["2026-09-28", "2026-10-27"]);
  });
  it("anchorForDate acha o ciclo da data", () => {
    expect(ymd(anchorForDate(new Date(2026, 10, 30), dayFor))).toBe("2026-12-01");
    expect(ymd(anchorForDate(new Date(2026, 11, 20), dayFor))).toBe("2027-01-01");
    expect(ymd(anchorForDate(new Date(2026, 11, 10), dayFor))).toBe("2026-12-01");
  });
});
