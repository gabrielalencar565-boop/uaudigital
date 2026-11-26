import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostCaptionField } from "./PostCaptionField";

type Pub = { id: string; caption: string | null; instagram_status: string };
const db = vi.hoisted(() => ({ caption: "" as string, pubs: [] as any[], updates: [] as [string, string | null][] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let patch: { caption: string | null } | null = null;
      const result = () => {
        if (patch) return { data: [{ id: "t1" }], error: null };
        if (table === "calendar_publications") return { data: db.pubs as Pub[], error: null };
        return { data: [], error: null };
      };
      const chain: any = {
        select: () => chain, eq: () => chain, is: () => chain, or: () => chain, in: () => chain, order: () => chain,
        update: (p: { caption: string | null }) => {
          patch = p; db.updates.push([table, p.caption]);
          if (table === "calendar_publications") db.pubs = db.pubs.map((x: Pub) => ({ ...x, caption: p.caption })); else db.caption = p.caption ?? "";
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: { caption: db.caption || null, post_key: null }, error: null }),
        then: (ok: any, fail: any) => Promise.resolve(result()).then(ok, fail),
      };
      return chain;
    },
  },
}));

const setup = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PostCaptionField taskId="t1" />
  </QueryClientProvider>,
);

beforeEach(() => { db.caption = ""; db.pubs = []; db.updates = []; });

describe("PostCaptionField", () => {
  it("só dá para escrever depois de clicar em Escrever legenda", async () => {
    setup();
    const button = await screen.findByRole("button", { name: /Escrever legenda/ });
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("salva ao concluir e passa a mostrar o texto com o botão de editar", async () => {
    setup();
    const button = await screen.findByRole("button", { name: /Escrever legenda/ });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pão quentinho" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(await screen.findByRole("button", { name: /Editar legenda/ })).toBeTruthy();
    expect(screen.getByText("Pão quentinho")).toBeTruthy();
    expect(db.updates).toEqual([["pm_tasks", "Pão quentinho"]]);
  });

  it("grava o que ficou pendente quando a tarefa é fechada no meio da digitação", async () => {
    const view = setup();
    const button = await screen.findByRole("button", { name: /Escrever legenda/ });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "quase perdida" } });
    view.unmount();
    await waitFor(() => expect(db.updates).toEqual([["pm_tasks", "quase perdida"]]));
  });

  it("no Cronograma é a mesma legenda: mostra a de lá e grava lá, inclusive ao apagar", async () => {
    db.pubs = [{ id: "pub1", caption: "legenda do cronograma", instagram_status: "not_published" }];
    setup();
    expect(await screen.findByText("legenda do cronograma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Editar legenda/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("legenda do cronograma");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(db.updates).toEqual([["calendar_publications", null]]));
  });

  it("post já publicado não deixa editar", async () => {
    db.pubs = [{ id: "pub1", caption: "no ar", instagram_status: "published" }];
    setup();
    expect(await screen.findByText(/já foi publicado/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Editar legenda/ })).toBeNull();
  });
});
