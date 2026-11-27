import { describe, expect, it } from "vitest";
import { applyDraft, blockedChanges, byFeedOrder, draftChanges, swapInDraft, validDraft, type FeedSwappable } from "./feed-swap";

const post = (id: string, date: string, time: string | null = "12:00:00", extra: Partial<FeedSwappable> = {}): FeedSwappable => ({
  id, publish_date: date, publish_time: time, instagram_status: "not_published", instagram_scheduled: false, ...extra,
});
const dates = (posts: FeedSwappable[]) => Object.fromEntries(posts.map((p) => [p.id, `${p.publish_date} ${p.publish_time}`]));

describe("ordem do feed", () => {
  const posts = [post("a", "2026-12-01", "12:00:00"), post("b", "2026-12-08", "18:00:00"), post("c", "2026-12-10")];

  it("trocar dois posts troca data e horário e muda a ordem da grade", () => {
    const draft = swapInDraft({}, posts, "a", "b");
    const shown = applyDraft(posts, draft);
    expect(dates(shown)).toEqual({ a: "2026-12-08 18:00:00", b: "2026-12-01 12:00:00", c: "2026-12-10 12:00:00" });
    expect([...shown].sort(byFeedOrder).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("trocas em sequência nunca deixam dois posts na mesma vaga", () => {
    let draft = swapInDraft({}, posts, "a", "b");
    draft = swapInDraft(draft, posts, "a", "c");
    const shown = Object.values(dates(applyDraft(posts, draft)));
    expect(new Set(shown).size).toBe(3);
  });

  it("voltar ao lugar original limpa o rascunho", () => {
    expect(swapInDraft(swapInDraft({}, posts, "a", "b"), posts, "b", "a")).toEqual({});
  });

  it("post publicado ou publicando não se move", () => {
    const list = [post("a", "2026-12-01", "12:00:00", { instagram_status: "published" }), post("b", "2026-12-08")];
    expect(swapInDraft({}, list, "a", "b")).toEqual({});
    expect(swapInDraft({}, list, "b", "a")).toEqual({});
  });

  it("descarta o rascunho inteiro se um dos posts mudou por fora", () => {
    const draft = swapInDraft({}, posts, "a", "b");
    expect(validDraft(draft, posts)).toBe(draft);
    expect(validDraft(draft, [post("a", "2026-12-02"), posts[1], posts[2]])).toEqual({});
    expect(validDraft(draft, [posts[0]])).toEqual({});
    expect(validDraft(draft, [{ ...posts[0], instagram_status: "published" }, posts[1]])).toEqual({});
  });

  it("bloqueia agendado que iria para horário passado ou ficaria sem horário", () => {
    const now = new Date("2026-12-05T12:00:00-03:00").getTime();
    const list = [
      post("antigo", "2026-12-01", "12:00:00"),
      post("agendado", "2026-12-08", "18:00:00", { instagram_scheduled: true }),
      post("semHora", "2026-12-12", null),
      post("outroAgendado", "2026-12-15", "09:00:00", { instagram_scheduled: true }),
    ];
    const past = blockedChanges(draftChanges(swapInDraft({}, list, "antigo", "agendado")), list, now);
    expect(past.past.map((c) => c.id)).toEqual(["agendado"]);
    const noTime = blockedChanges(draftChanges(swapInDraft({}, list, "semHora", "agendado")), list, now);
    expect(noTime.noTime.map((c) => c.id)).toEqual(["agendado"]);
    const fine = blockedChanges(draftChanges(swapInDraft({}, list, "agendado", "outroAgendado")), list, now);
    expect(fine).toEqual({ past: [], noTime: [] });
  });
});
