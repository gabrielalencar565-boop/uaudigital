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

  it("salva ao sair do campo e o texto continua na caixa, sem lápis nem Concluir", async () => {
    setup();
    const button = await screen.findByRole("button", { name: /Escrever legenda/ });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pão quentinho" } });
    fireEvent.blur(screen.getByRole("textbox"));
    await waitFor(() => expect(db.updates).toEqual([["pm_tasks", "Pão quentinho"]]));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Pão quentinho");
    expect(screen.queryByRole("button")).toBeNull();
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
    const field = (await screen.findByDisplayValue("legenda do cronograma")) as HTMLTextAreaElement;
    fireEvent.focus(field); // é só clicar no texto
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    await waitFor(() => expect(db.updates).toEqual([["calendar_publications", null]]));
    expect(await screen.findByRole("button", { name: /Escrever legenda/ })).toBeTruthy();
  });

  it("post já publicado não deixa editar", async () => {
    db.pubs = [{ id: "pub1", caption: "no ar", instagram_status: "published" }];
    setup();
    expect(await screen.findByText(/já foi publicado/)).toBeTruthy();
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    fireEvent.focus(field);
    fireEvent.blur(field);
    expect(db.updates).toEqual([]);
  });
});
