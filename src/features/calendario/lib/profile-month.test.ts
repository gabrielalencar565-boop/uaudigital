import { describe, expect, it } from "vitest";
import { moveItem, profileGrid, startingProfile, togglePinned, type ProfileRow } from "./profile-month";

const row = (month: string, name: string, extra: Partial<ProfileRow> = {}): ProfileRow => ({
  id: `id-${month}`, month, photo_url: null, display_name: name, highlights: [], pinned_publication_ids: [], ...extra,
});
const client = { name: "Uau Digital", photo: "logo.png" };

describe("perfil do mês", () => {
  const rows = [row("2026-10-01", "outubro"), row("2026-11-01", "novembro"), row("2027-01-01", "janeiro")];

  it("mês já salvo abre o próprio perfil", () => {
    const start = startingProfile(rows, "2026-11-01", client);
    expect(start).toMatchObject({ savedId: "id-2026-11-01", copiedFrom: null, draft: { display_name: "novembro" } });
  });

  it("mês novo começa como cópia do salvo mais recente antes dele, sem herdar o registro", () => {
    const start = startingProfile(rows, "2026-12-01", client);
    expect(start).toMatchObject({ savedId: null, copiedFrom: "2026-11-01", draft: { display_name: "novembro" } });
  });

  it("antes do primeiro mês salvo usa o mais recente que existir", () => {
    expect(startingProfile(rows, "2026-01-01", client).copiedFrom).toBe("2027-01-01");
  });

  it("sem nada salvo usa a foto e o nome do cliente", () => {
    expect(startingProfile([], "2026-12-01", client).draft).toEqual({ photo_url: "logo.png", display_name: "Uau Digital", highlights: [], pinned_publication_ids: [] });
  });

  it("ignora destaques gravados em formato quebrado", () => {
    const start = startingProfile([row("2026-12-01", "x", { highlights: [null, "a", { title: "sem id" }, { id: "1", title: "Natal" }] })], "2026-12-01", client);
    expect(start.draft.highlights).toEqual([{ id: "1", title: "Natal", cover_url: null }]);
  });

  it("fixa no máximo 3 e desafixa ao clicar de novo", () => {
    expect(togglePinned(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(togglePinned(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(togglePinned(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("move destaques sem sair da lista", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it("grade: fixados na ordem escolhida, sem repetir, ignorando post que não existe mais", () => {
    const grid = profileGrid([{ id: "a" }, { id: "b" }, { id: "c" }], ["c", "sumiu", "a"]);
    expect(grid.map((g) => [g.post.id, g.pinned])).toEqual([["c", true], ["a", true], ["b", false]]);
  });
});
