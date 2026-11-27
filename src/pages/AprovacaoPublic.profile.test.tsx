import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AprovacaoPublic from "./AprovacaoPublic";

vi.mock("@/features/data/queries", () => ({ useAppSettings: () => ({ data: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const pub = (id: string, day: string) => ({
  id, title: id, content_type: "imagem", caption: "", publish_date: `2026-12-${day}`, publish_time: "12:00:00", status: "aguardando_aprovacao",
  client_note: null, client_feedback: null, order_index: 0, media: [{ url: `https://x.test/${id}.jpg`, type: "image/jpeg", name: null }],
});
const base = {
  clientName: "Doce Rio", clientLogoUrl: null,
  calendar: { cycleStart: "2026-11-26", cycleEnd: "2026-12-31", status: "enviado_ao_cliente", updatedAt: "2026-11-27T12:00:00Z" },
  publications: [pub("a", "01"), pub("b", "10")],
};
const respond = (body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })));
const setup = () => render(
  <MemoryRouter initialEntries={["/aprovacao/t"]}><Routes><Route path="/aprovacao/:token" element={<AprovacaoPublic />} /></Routes></MemoryRouter>,
);

beforeEach(() => vi.unstubAllGlobals());

describe("link do cliente com destaques e fixados", () => {
  it("mantém o feed de antes, com destaques acima e fixados no topo", async () => {
    respond({
      ...base,
      profile: {
        username: "docerio.bdc", photoUrl: null, displayName: "Doce Rio no Natal",
        highlights: [{ id: "h1", title: "Natal", cover_url: null }],
        pinnedIds: ["a", "velho"],
        olderPinned: [{ id: "velho", publishDate: "2026-10-05", thumbUrl: "https://x.test/velho.jpg", isCarousel: false, isVideo: false }],
      },
    });
    const view = setup();
    const highlights = await screen.findByRole("list", { name: "Destaques" });
    expect(within(highlights).getByText("Natal")).toBeTruthy();
    // sem o celular nem as barrinhas de seguidores
    expect(screen.queryByRole("region", { name: "Prévia do perfil" })).toBeNull();
    expect(screen.queryByText("seguidores")).toBeNull();
    const images = [...view.container.querySelectorAll("main .grid img")].map((img) => img.getAttribute("src")!.split("/").pop());
    expect(images).toEqual(["a.jpg", "velho.jpg", "b.jpg"]); // fixados primeiro, depois o resto como era
    const pins = screen.getAllByLabelText("Post fixado");
    expect(pins.length).toBe(2);
    expect(pins[0].closest("button")).toBeTruthy(); // fixado do período abre para aprovar
    expect(pins[1].closest("button")).toBeNull(); // fixado antigo só aparece
  });

  it("sem perfil salvo, o link fica igual ao de antes", async () => {
    respond({ ...base, profile: null });
    const view = setup();
    await screen.findByRole("heading", { name: "Doce Rio" });
    expect(screen.queryByRole("list", { name: "Destaques" })).toBeNull();
    expect(screen.queryByLabelText("Post fixado")).toBeNull();
    expect([...view.container.querySelectorAll("main .grid img")].map((img) => img.getAttribute("src")!.split("/").pop())).toEqual(["b.jpg", "a.jpg"]);
  });
});
