import { describe, expect, it } from "vitest";
import { byName, compareNames } from "./sort";

describe("alphabetical order by name", () => {
  it("ignores case and accents, like a person would", () => {
    const names = ["Zé", "ótica Mateus", "Ana", "bruna", "Édson"];
    expect([...names].sort(compareNames)).toEqual(["Ana", "bruna", "Édson", "ótica Mateus", "Zé"]);
  });

  it("puts numbers in numeric order", () => {
    expect(["Cliente 10", "Cliente 2", "Cliente 1"].sort(compareNames)).toEqual(["Cliente 1", "Cliente 2", "Cliente 10"]);
  });

  it("sorts objects by a field and survives missing names", () => {
    const list = [{ n: "Beto" }, { n: null }, { n: "Alice" }];
    expect(list.sort(byName((x) => x.n)).map((x) => x.n)).toEqual([null, "Alice", "Beto"]);
  });
});
