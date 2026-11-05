import { describe, expect, it } from "vitest";
import { moveItem, newStampsFor, reorderStamps } from "./subtask-order";

const L = ["a", "b", "c", "d"].map((id) => ({ id }));
const ids = (l: Array<{ id: string }> | null) => l?.map((x) => x.id).join("");

describe("moveItem", () => {
  it("move para antes e para depois do alvo", () => {
    expect(ids(moveItem(L, "d", "b", false))).toBe("adbc");
    expect(ids(moveItem(L, "a", "c", true))).toBe("bcad");
    expect(ids(moveItem(L, "b", "d", true))).toBe("acdb");
    expect(ids(moveItem(L, "c", "a", false))).toBe("cabd");
  });
  it("devolve null quando a ordem não muda", () => {
    expect(moveItem(L, "a", "a", true)).toBeNull();
    expect(moveItem(L, "b", "c", false)).toBeNull(); // já está antes do c
    expect(moveItem(L, "c", "b", true)).toBeNull(); // já está depois do b
  });
  it("ignora ids que não estão na lista", () => {
    expect(moveItem(L, "x", "a", true)).toBeNull();
    expect(moveItem(L, "a", "x", true)).toBeNull();
  });
});

describe("reorderStamps / newStampsFor", () => {
  it("ordena e desempata horários iguais", () => {
    expect(reorderStamps([30, 10, 20])).toEqual([10, 20, 30]);
    expect(reorderStamps([10, 10, 10])).toEqual([10, 11, 12]);
    expect(reorderStamps([10, 10, 11])).toEqual([10, 11, 12]);
  });
  it("a nova ordem recebe os mesmos horários, em ordem crescente", () => {
    const t = (id: string, iso: string) => ({ id, created_at: iso });
    const ordered = [t("c", "2026-11-05T10:00:03.000000+00:00"), t("a", "2026-11-05T10:00:01.000000+00:00"), t("b", "2026-11-05T10:00:02.000000+00:00")];
    expect(newStampsFor(ordered)).toEqual([
      Date.parse("2026-11-05T10:00:01.000Z"),
      Date.parse("2026-11-05T10:00:02.000Z"),
      Date.parse("2026-11-05T10:00:03.000Z"),
    ]);
  });
});
